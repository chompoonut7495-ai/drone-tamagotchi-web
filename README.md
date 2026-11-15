# SPANNER-GOTCHI (Drone Pet Web Frontend)

Web application for monitoring drone configuration, status, and logging temperature readings via the Drone API Server.

## Tech Stack
- HTML, CSS, JavaScript (Vite)
- Custom API Integration (`drone-api-server`)

## Features
1. **View Config:** Displays Drone ID, Drone Name, Light status, Country, and Condition.
2. **Log Temp:** Form to submit current temperature (Celsius) via `POST /logs`.
3. **View Logs:** Displays temperature logs sorted by newest first (12 items per page) with pagination support.

## Environment Variables
Create a `.env` file in the root directory before running locally:

```env
VITE_API_URL=[https://drone-api-spanner.onrender.com](https://drone-api-spanner.onrender.com)
VITE_DRONE_ID=67010177