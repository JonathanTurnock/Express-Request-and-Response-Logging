# Logging Express Request & Response Content

## Introduction
While Logging the Request object in Express is amazingly easy, doing so with the response is not
 quite as straight forwards.
 
We need to utilize a couple of tricks and some patching to get things working smoothly and get
 all the information we are sending back to the client.
 
We can also use this technique to perform some other manipulation rather than just logging, some
 use cases might be:
 1. To Observe the response (Logging, Tracing)
 2. To Amend the response (Redacting information by origin for example or modify response for
  target audience)

## The Middleware
### Logging the Request
Firstly we need to create a basic middleware which can log our req, nothing new here other than
 our middleware is a higher order function which takes a logger making it more re-usable.
```javascript
const requestLoggerMiddleware = ({ logger }) => (req, res, next) => {
  logger("RECV <<<", req.method, req.url, req.hostname);
  ...
  next();
};
```
 
### Logging the Response
Next we need to log our response. As we can see we have access to the response under the
 reference `res`. However, this does not have the information we need yet. 
 
Our middleware runs **BEFORE** our router, so if we call for any information on our `res` now
 it will not be reflective of the res state after the router has done its thing.
 
We need to add an event hook to be invoked after the `finish` event, more info on this event can
 be found in the docs: https://nodejs.org/api/http.html#http_event_finish 

Crucially however we need to be aware of the purpose of the event

> Emitted when the response has been sent. More specifically, this event is emitted when the last 
> segment of the response headers and body have been handed off to the operating system for
> transmission over the network. It does not imply that the client has received anything yet.

```javascript
 const requestLoggerMiddleware = ({ logger }) => (req, res, next) => {
   ...
   res.on("finish", () => {
     logger("SEND >>>", res.statusCode);
   });
   next();
 };
 ```

This gives us the basic ability to observe information about the response after handoff, good for
 observability but bad for interception, and the `res` is also missing the crucial content sent to
  `res.send`
  
### Intercepting res.send
For this last piece we need to monkey patch the `res.send` method. This means when we call it in
 our router, for example:
```javascript
 app.get(["/", "/api/health"], (req, res) => {
   res.send({ message: "OK", uptime: process.uptime() });
 });
```

We are actually going to be calling our patched `res.send`, doing something, then calling the
 original `res.send`. We call this the `interceptor` because it's intercepting the call
 , performing some actions and handing back off.
 
This is going to give us a critical point to interject and do whatever we need. For observability
, we will simply bind the content passed to `res.send` to the `res` under `res.contentBody
` giving us access later, but you could just as easily perform some mutation and intercept the
 content for redacting, modifying, adapting etc. 
 
Let's add the interceptor and explain it's signature.  
 ```javascript
const requestLoggerMiddleware = ({ logger }) => (req, res, next) => {
    ...  
    res.send = resDotSendInterceptor(res, res.send);
    ...
    next();
};
```

We can see how the interceptor replaces the default `res.send`, as this middleware runs *BEFORE* our
 router. We know that this patch is now in place and any subsequent calls to `res.send` will go via
  our interceptor.
  
  
### Designing the interceptor

Our interceptor needs two things:
1. To be a function that can take the content sent to `res.send` normally
2. To be a function which ultimately calls the original `res.send` so the request/response chain
 can complete naturally.
 
Therefore, we write our interceptor as a Higher Order Function taking the res, and the original
 unmodified send. Finally, that returns a function which takes the content passed to `res.send` in
  the router.
  
 ```javascript
const resDotSendInterceptor = (res, send) => (content) => {
  res.contentBody = content;
  res.send = send;
  res.send(content);
};
``` 

By the time the rouer has called `res.send` and the request `finish` event is broadcast, our
 interceptor has put the content passed to `res.send` in the router onto our `res` under the
  field `contentBody` making this now accessible in the `finish` callback.
 
 ```javascript
const requestLoggerMiddleware = ({ logger }) => (req, res, next) => {
  ...
  res.on("finish", () => {
    logger("SEND >>>", res.contentBody);
  });
  next();
};
```

## Conclusion
While the topic at first can seem quite confusing I highly recommend taking a look at the
 middleware and app discussed above. 
 
Checkout the project on [Github](https://github.com/JonathanTurnock/ReqResLoggingExample) to
  see things running.
