const app = require("./app");
const connectDatabase = require("./config/database");

connectDatabase();

const server = app.listen(process.env.PORT, () => {
  console.log(
    `server listening to the port: ${process.env.PORT} in ${process.env.NODE_ENV}`
  );
});

// connection string Error->unhandledRejection /promise rejection
process.on("unhandledRejection", (err) => {
  console.log(`Error : ${err.message}`);
  console.log("shutting down the server due to unhandled rejection error");
  server.close(() => {
    process.exit(1); //to exit with failure status code
  });
});
// here we not difine vareable but we need to log ,so we get uncaughtExeption Error
process.on("uncaughtException", (err) => {
  console.log(`Error : ${err.message}`);
  console.log("shutting down the server due to uncought exception error");
  server.close(() => {
    process.exit(1);
  });
});
