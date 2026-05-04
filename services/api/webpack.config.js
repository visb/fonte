const path = require("path");

module.exports = {
  entry: "./dist/main.js",
  target: "node",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "main.bundle.js",
  },
  externals: [], // Bundle everything
};
