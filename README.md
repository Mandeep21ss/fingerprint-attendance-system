# 🔐 ESP32 + R305 Fingerprint Attendance System

A production-ready biometric attendance system using **ESP32 microcontroller** with **R305 fingerprint sensor**, powered by a **Node.js/Express** backend, **MongoDB** database, and a modern **React** frontend with real-time updates via **Socket.io**.

---

## 📁 Project Structure

```
fingerprint-attendance-system/
├── esp32/
│   └── fingerprint_attendance.ino    # ESP32 Arduino firmware
├── backend/
│   ├── server.js                     # Express server entry point
│   ├── seed.js                       # Admin seed script
│   ├── .env                          # Environment variables
│   ├── config/db.js                  # MongoDB connection
│   ├── models/
│   │   ├── Student.js                # Student schema
│   │   ├── Attendance.js             # Attendance schema
│   │   └── Admin.js                  # Admin schema (bcrypt)
│   ├── routes/
│   │   ├── auth.js                   # Login/auth routes
│   │   ├── students.js               # Student CRUD
│   │   └── attendance.js             # Attendance + stats
│   └── middleware/auth.js            # JWT middleware
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                   # Root + routing
│       ├── index.css                 # Global styles
│       ├── context/AuthContext.jsx    # Auth state
│       ├── utils/api.js              # Axios instance
│       ├── components/Navbar.jsx     # Sidebar nav
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Students.jsx
│           └── Attendance.jsx
└── README.md
```

---

## 🔌 Hardware Requirements

| Component       | Quantity | Notes                        |
|-----------------|----------|------------------------------|
| ESP32 Dev Board | 1        | Any ESP32 variant            |
| R305 Fingerprint Sensor | 1 | UART interface             |
| Jumper Wires    | 4        | Female-to-female recommended |
| Buzzer (optional) | 1      | For audio feedback           |
| USB Cable       | 1        | For ESP32 programming        |

### Wiring Diagram

```
R305 Sensor         ESP32
───────────         ─────
  TX (Green)  ───→  GPIO16 (RX2)
  RX (White)  ←───  GPIO17 (TX2)
  VCC (Red)   ───→  3.3V
  GND (Black) ───→  GND
```

---

## ⚙️ Arduino Setup (ESP32 Firmware)

### 1. Install Arduino IDE
Download from [arduino.cc](https://www.arduino.cc/en/software)

### 2. Add ESP32 Board Support
1. Go to **File → Preferences**
2. Add this URL to "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Go to **Tools → Board → Board Manager**
4. Search **"ESP32"** and install **"ESP32 by Espressif Systems"**

### 3. Install Required Libraries
Go to **Sketch → Include Library → Manage Libraries** and install:

| Library                          | Version |
|----------------------------------|---------|
| Adafruit Fingerprint Sensor Library | 2.1+  |
| ArduinoJson                      | 6.x+    |

> `WiFi.h` and `HTTPClient.h` come pre-installed with the ESP32 board package.

### 4. Configure the Firmware
Open `esp32/fingerprint_attendance.ino` and update:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://YOUR_PC_IP:5000/api/attendance";
```

> 💡 Find your PC's IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

### 5. Upload to ESP32
1. Select **Tools → Board → ESP32 Dev Module**
2. Select the correct **COM port**
3. Click **Upload**
4. Open **Serial Monitor** at **115200 baud**

### 6. Serial Commands
| Command         | Description                    |
|-----------------|--------------------------------|
| `ENROLL <id>`   | Enroll fingerprint at ID 1-127 |
| `ATTEND`        | Switch to attendance mode      |
| `DELETE <id>`   | Delete stored fingerprint      |
| `COUNT`         | Show stored fingerprint count  |
| `HELP`          | Show available commands        |

---

## 🖥️ Backend Setup

### Prerequisites
- **Node.js** 18+ ([download](https://nodejs.org))
- **MongoDB** 6+ ([download](https://www.mongodb.com/try/download/community)) or use [MongoDB Atlas](https://cloud.mongodb.com)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Edit `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/fingerprint_attendance
JWT_SECRET=change_this_to_a_random_string
ADMIN_EMAIL=admin@attendance.com
ADMIN_PASSWORD=Admin@123
CLIENT_URL=http://localhost:5173
```

### 3. Seed Admin Account
```bash
npm run seed
```

### 4. Start the Server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs at `http://localhost:5000`

### API Endpoints

| Method | Endpoint              | Description               | Auth |
|--------|-----------------------|---------------------------|------|
| POST   | `/api/auth/login`     | Admin login               | No   |
| POST   | `/api/auth/seed`      | Create default admin      | No   |
| GET    | `/api/auth/me`        | Get current admin         | Yes  |
| POST   | `/api/students`       | Add student               | No*  |
| GET    | `/api/students`       | List students             | No   |
| PUT    | `/api/students/:id`   | Update student            | Yes  |
| DELETE | `/api/students/:id`   | Delete student            | Yes  |
| POST   | `/api/attendance`     | Record attendance (ESP32) | No   |
| GET    | `/api/attendance`     | List attendance records   | No   |
| GET    | `/api/attendance/today` | Today's attendance      | No   |
| GET    | `/api/attendance/stats` | Dashboard statistics    | No   |
| GET    | `/api/health`         | Health check              | No   |

---

## 🎨 Frontend Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

Frontend runs at `http://localhost:5173`

### 3. Default Login
```
Email:    admin@attendance.com
Password: Admin@123
```

### Pages
- **Login** — Admin authentication
- **Dashboard** — Stats cards, 7-day chart, recent activity, live notifications
- **Students** — Add/edit/delete students with fingerprint ID mapping
- **Attendance** — Search, filter by date/range, pagination, CSV export

---

## 🚀 Complete Startup Guide

```bash
# Terminal 1 — Start MongoDB (if local)
mongod

# Terminal 2 — Start Backend
cd backend
npm install
npm run seed    # First time only
npm run dev

# Terminal 3 — Start Frontend
cd frontend
npm install
npm run dev
```

Then:
1. Open `http://localhost:5173` in your browser
2. Login with `admin@attendance.com` / `Admin@123`
3. Add students and assign fingerprint IDs (1-127)
4. Power on ESP32, enroll fingerprints via Serial Monitor
5. Fingerprints scanned on ESP32 → attendance appears in real-time!

---

## 📡 How It Works

```
1. Student places finger on R305 sensor
2. ESP32 reads & matches fingerprint → gets ID
3. ESP32 sends HTTP POST to backend with fingerprint ID
4. Backend looks up student by fingerprint ID
5. Backend creates attendance record in MongoDB
6. Socket.io broadcasts event to all connected frontends
7. Dashboard updates in real-time with toast notification
```

---

## 🔒 Environment Variables

| Variable         | Description                    | Default                        |
|------------------|--------------------------------|--------------------------------|
| `PORT`           | Backend server port            | `5000`                         |
| `MONGO_URI`      | MongoDB connection string      | `mongodb://localhost:27017/...` |
| `JWT_SECRET`     | Secret for JWT signing         | (must change in production)    |
| `ADMIN_EMAIL`    | Default admin email            | `admin@attendance.com`         |
| `ADMIN_PASSWORD` | Default admin password         | `Admin@123`                    |
| `CLIENT_URL`     | Frontend URL for CORS          | `http://localhost:5173`        |

---

## 🏗️ Production Deployment

### Backend
```bash
cd backend
npm install --production
NODE_ENV=production node server.js
```

### Frontend
```bash
cd frontend
npm run build
# Serve the `dist/` folder with nginx or any static server
```

### MongoDB Atlas (Cloud)
1. Create free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Get connection string and update `MONGO_URI` in `.env`

---

## 📝 License
MIT — Free for personal and commercial use.
