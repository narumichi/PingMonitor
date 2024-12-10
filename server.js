const express = require("express");
const fs = require("fs");
const path = require("path");
const ping = require("ping");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = 3000;
const LOG_DIR = "./logs";
const PING_TARGET = "8.8.8.8";
const PING_INTERVAL = 10 * 1000;

if (!fs.existsSync(LOG_DIR)) {
	fs.mkdirSync(LOG_DIR);
}

function getLogFileName(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}.csv`;
}

function appendToLogFile(content) {
	const fileName = getLogFileName();
	const filePath = path.join(LOG_DIR, fileName);

	fs.appendFile(filePath, content + "\n", (err) => {
		if (err) {
			console.error("Error writing to log file:", err);
		}
	});
}

function pingAndLog() {
	ping.promise.probe(PING_TARGET, { timeout: 1 })
		.then((res) => {
			const timestamp = new Date().toISOString();
			let logEntry;

			if (res.alive) {
				logEntry = `${timestamp},${res.time}`;
				console.log(`[SUCCESS] ${timestamp} - Response time: ${res.time} ms`);
			} else {
				logEntry = `${timestamp},Ping failed`;
				console.log(`[FAILURE] ${timestamp} - Ping failed`);
			}

			appendToLogFile(logEntry);

			// WebSocket クライアントに送信
			wss.clients.forEach((client) => {
				if (client.readyState === 1) {
					client.send(logEntry);
				}
			});
		})
		.catch((err) => {
			console.error("Ping error:", err);
		});
}

setInterval(pingAndLog, PING_INTERVAL);

app.use(express.static("public"));

app.get("/logs", (req, res) => {
	const dateQuery = req.query.date;
	if (!dateQuery) {
		return res.status(400).send("Date query parameter is required.");
	}

	const logFileName = `${dateQuery}.csv`;
	const logFilePath = path.join(LOG_DIR, logFileName);

	fs.readFile(logFilePath, "utf8", (err, data) => {
		if (err) {
			if (err.code === "ENOENT") {
				return res.status(200).send("");
			}
			return res.status(500).send("Error reading log file.");
		}

		res.send(data);
	});
});

const server = app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
	console.log("New WebSocket connection established");

	// クライアント切断時
	ws.on("close", () => {
		console.log("WebSocket connection closed");
	});
});
