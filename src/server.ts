import { createApp } from "./app.js";
import { config } from "./config.js";

createApp().listen(
    config.PORT, () => console.log(`API sur http://localhost:${config.PORT}`));