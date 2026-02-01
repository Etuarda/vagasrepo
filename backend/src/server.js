// src/server.js
require("dotenv").config(); // redundante, mas seguro

const { app } = require("./app");
const env = require("./config/env");

app.listen(env.PORT, () => {
  console.log(`Vagas.io API rodando em http://localhost:${env.PORT}`);
});
