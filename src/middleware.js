/**
 * Interceptor function used to monkey patch the res.send until it is invoked
 * at which point it intercepts the invokation, executes is logic such as res.contentBody = content
 * then restores the original send function and invokes that to finalize the req/res chain.
 *
 * @param res Original Response Object
 * @param send Original UNMODIFIED res.send function
 * @return A patched res.send which takes the send content, binds it to contentBody on
 * the res and then calls the original res.send after restoring it
 */
const resDotSendInterceptor = (res, send) => (content) => {
    res.contentBody = content;
    res.send = send;
    res.send(content);
};

/**
 * Middleware which takes an initial configuration and returns a middleware which will call the
 * given logger with the request and response content.
 *
 * @param logger Logger function to pass the message to
 * @return Middleware to perform the logging
 */
const requestLoggerMiddleware = ({ logger }) => (req, res, next) => {
    logger("RECV <<<", req.method, req.url, req.hostname);
    res.send = resDotSendInterceptor(res, res.send);
    res.on("finish", () => {
        logger("SEND >>>", res.contentBody);
    });
    next();
};

module.exports = { requestLoggerMiddleware };
