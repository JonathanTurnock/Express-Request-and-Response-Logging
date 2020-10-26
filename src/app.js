const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();
const { requestLoggerMiddleware } = require("./middleware");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(requestLoggerMiddleware({ logger: console.log }));

app.get(["/", "/api/health"], (req, res) => {
    res.send({ message: "OK", uptime: process.uptime() });
});

module.exports = app;
