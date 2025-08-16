module.exports = {
    apps: [
      {
        name: "stablr",
        script: "npm",
        args: "start",
        autorestart: true, // Restart the app if it crashes
        PORT: 3334      
      },
    ],
  };
  