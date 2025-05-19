# 🏗️ Construction Map

**A multiuser, multidevice platform for construction site coordination — built to run lean, scale fast, and deploy anywhere.**

Construction Map simplifies on-site project management with real-time event tracking, intelligent map layering, and seamless team collaboration. Whether running locally or on Google Cloud, this full-stack app is designed to operate with minimal infrastructure while maximizing impact.

---

## ✨ Key Features

- **📍 Map-Based Event Tracking** – Pinpoint issues, attach photos, and track resolution status spatially.
- **🗂️ Multi-layered Maps** – Overlay PDF, JPG, PNG, and SVG blueprints for comparison and change tracking.
- **💬 Threaded Comments & Mentions** – Collaborate directly on the map with notifications and mentions.
- **📁 Role-Based Access** – Admin/member permissions at the project level.
- **📦 Cloud-Ready** – Dockerized, GCP-friendly (Cloud SQL, Cloud Run, GCS).

---

## ⚙️ Architecture Overview


![Screenshot 2025-05-16 at 14 11 11](https://github.com/user-attachments/assets/4a043a0c-d30a-44fa-b1fc-0433570a4b5c)

| Layer     | Stack                                                                 |
|-----------|------------------------------------------------------------------------|
| Frontend  | React (Bootstrap 5, Axios, React Router), served via Nginx             |
| Backend   | FastAPI (Python), SQLAlchemy, Pydantic, JWT Auth, Alembic              |
| Database  | PostgreSQL (production via Cloud SQL)                |
| Storage   | Local filesystem (dev), Google Cloud Storage (prod)                    |
| Container | Docker for local dev & production deployment (Cloud Run ready)         |

📁 **Modular Structure**:
- `backend/` – API logic, models, migrations, services
- `frontend/` – React app with components, pages, services
- `mdfiles/` – Documentation, deployment notes, and environment plans

## 🌿 Branch Structure
development: Used for local development and testing new features
production: Deployment-ready code currently running in production

---

## 🖥️ Local Development
Apply to README.md
Run
 
## 🐳☁️ GCP Deployment (Cloud Run + Cloud SQL)
> For full steps, see `mdfiles/GCP_DEPLOYMENT.md`
🐍 create_cloud_schema.py handles database setup and migration
🔐 Socket-based connection to Cloud SQL
🗃️ Static files served via Nginx
☁️ Uploaded files stored in GCS bucket

## 📁 Project Layout

```
rauladse-construction_map/
├── backend/         # FastAPI backend (API, DB, services, tests)
├── frontend/        # React frontend (components, pages, styles)
├── mdfiles/         # Deployment & system documentation
├── docker-compose.yml
├── run_server.py / start_servers.sh / stop_servers.sh
├── .env.*.example   # Environment-specific templates
└── README.md
```

---

## 📹 Demo

🎬 https://youtu.be/RB5qGtLw1lQ – See how Construction Map enables field workers and managers to coordinate visually, report issues, and track progress directly on project blueprints.

---

## 🔐 Security Highlights

* Enforced CORS & HTTPS in production
* JWT-based auth & secure password hashing
* Role-based access control per project
* SSL-secured connections to Cloud SQL
* `.env` secrets excluded via `.gitignore` + documented in [`SECRETS_MANAGEMENT.md`](./mdfiles/SECRETS_MANAGEMENT.md)

---

## 📄 License

MIT License © 2025 Servitec Ingeniería
