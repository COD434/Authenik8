import app, {appReady} from "./script";

export const PORT = Number.parseInt(process.env.PORT || "5000", 10);

const startServer = async () => {
  await appReady;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
});
