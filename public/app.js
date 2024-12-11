const responseTimes = [];
let currentDate = new Date();

async function loadLogs(date) {
	responseTimes.length = 0;
	
	const isoDate = date.toISOString().split("T")[0];
	const response = await fetch(`/logs?date=${isoDate}`);
	const text = await response.text();
	const currentDate = document.getElementById("current-day");
	currentDate.innerHTML = isoDate;

	const lines = text.split("\n");
	lines.forEach((line) => {
		const parts = line.split(",");
		if (parts.length < 2) return;
		
		const timestamp = new Date(parts[0]);
		const value = parts[1] === "Ping failed" ? -1 : parseFloat(parts[1]); // 失敗は -1 を入れておく。その他はそのままの値。
		
		responseTimes.push({ time: timestamp, value });
	});
	updateHeatmap();
}

function initializeHeatmap() {
	const today = new Date(currentDate);
	today.setHours(0, 0, 0, 0);
	responseTimes.length = 0;
	
	for (let hour = 0; hour < 24; hour++) {
		const dateTime = new Date(today.getTime() + hour * 60 * 60 * 1000);
		responseTimes.push({ time: dateTime, value: null });
	}
}

function updateHeatmap() {
	const canvas = document.getElementById("heatmap");
	const ctx = canvas.getContext("2d");
	const pageHeight = window.innerHeight;
	const rowHeight = Math.floor(pageHeight / 24);
	const labelWidth = 50;
	const containerWidth = canvas.clientWidth - labelWidth;
	const pixelsPerMs = containerWidth / (60 * 60 * 1000);
	
	canvas.width = containerWidth + labelWidth;
	canvas.height = 24 * rowHeight;
	
	drawHourLabels(ctx, labelWidth, rowHeight);
	drawTimeLines(ctx, labelWidth, containerWidth, rowHeight);
	
	for (let hour = 0; hour < 24; hour++) {
		const rowIndex = hour;
		const y = rowIndex * rowHeight;
		
		const hourStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, 0, 0);
		const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
		const hourData = responseTimes.filter((data) => data.time >= hourStart && data.time < hourEnd);
		
		let prevTime = hourStart;

		hourData.forEach((entry) => {
			const x = labelWidth + (entry.time - hourStart) * pixelsPerMs;
			const width = (entry.time - prevTime) * pixelsPerMs;
			
			if (entry.value === null || entry.value === undefined) {
				// ログがない部分はスキップ
				prevTime = entry.time;
				return;
			}
			
			if (entry.value < 0) {
				ctx.fillStyle = "rgb(255, 0, 0)"; // Ping失敗は赤
			} else {
				const intensity = Math.min(entry.value / 200, 1);
				const grayValue = 255 - Math.floor(intensity * 255);
				ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
			}
			
			ctx.fillRect(x, y, width, rowHeight);
			prevTime = entry.time;
		});
	}
	
	drawTimeMarkers(ctx, labelWidth, containerWidth, rowHeight);
}

function drawTimeLines(ctx, labelWidth, width, rowHeight) {
	for (let row = 0; row < 24; row++) {
		const centerY = row * rowHeight + rowHeight / 2; // ヒートマップの上下中央
		
		ctx.fillStyle = "black";
		ctx.fillRect(labelWidth, centerY - 1, width, 2);
	}
}

function drawTimeMarkers(ctx, labelWidth, width, rowHeight) {
	const pixelsPerMinute = width / 60; // 1分あたりのピクセル数
	const largeMarkerRadius = rowHeight / 8; // 30分ごとの円の半径
	const smallMarkerRadius = rowHeight / 16; // 5分ごとの円の半径
	
	for (let row = 0; row < 24; row++) {
		const centerY = row * rowHeight + rowHeight / 2; // ヒートマップの上下中央
		
		for (let minute = 0; minute <= 60; minute += 5) { // 5分おきに描画
			const centerX = labelWidth + minute * pixelsPerMinute;
			
			if (minute % 10 === 0) {
				// 10分ごとに数字を描画
				if (minute % 60 === 0) continue;
				ctx.beginPath();
				ctx.arc(centerX, centerY, largeMarkerRadius, 0, 2 * Math.PI);
				ctx.fillStyle = "black";
				ctx.fill();
			} else {
				// 5分ごとの小さな円
				ctx.beginPath();
				ctx.arc(centerX, centerY, smallMarkerRadius, 0, 2 * Math.PI);
				ctx.fillStyle = "black";
				ctx.fill();
			}
		}
	}
}

function drawHourLabels(ctx, labelWidth, rowHeight) {
	ctx.fillStyle = "black";
	ctx.font = `${rowHeight / 2}px Arial`;
	ctx.textAlign = "right";
	ctx.textBaseline = "middle";
	
	for (let row = 0; row < 24; row++) {
		const centerY = row * rowHeight + rowHeight / 2;
		const hourText = `${String(row).padStart(2, "0")}`;
		ctx.fillText(hourText, labelWidth - 10, centerY);
	}
}

window.onload = async () => {
	await loadLogs(currentDate);
	
	document.getElementById("prev-day").addEventListener("click", async () => {
		currentDate.setDate(currentDate.getDate() - 1);
		await loadLogs(currentDate);
	});
	
	document.getElementById("next-day").addEventListener("click", async () => {
		currentDate.setDate(currentDate.getDate() + 1);
		await loadLogs(currentDate);
	});
	
	
	// WebSocket 設定
	const ws = new WebSocket(`ws://${location.host}`);
	ws.onmessage = (event) => {
		const [timestamp, value] = event.data.split(",");
		const time = new Date(timestamp);
		
		if (value === "Ping failed") {
			responseTimes.push({ time, value: -1 });
		} else {
			responseTimes.push({ time, value: parseFloat(value) });
		}
		
		updateHeatmap();
	};
};
