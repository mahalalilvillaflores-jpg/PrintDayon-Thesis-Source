PrintDayon --- Thesis Source Code

PrintDayon is a print shop locator and ordering system developed as a
thesis project. It connects customers with local printing shops and
provides tools for shop owners and administrators to manage the
platform.

System Structure

The project is divided into two main parts:

frontend/ --- Web application containing the Customer, Shop Owner,
and Admin portals

backend/ --- Server-side API, authentication, database operations,
shop management, orders, reviews, and related services

Frontend Portals

Customer Portal

Customers can: - Find and view printing shops - View shop ratings,
services, prices, and operating information - View shop locations and
routes - Submit and track print requests - View request history - Leave
reviews and ratings

Shop Owner Portal

Shop owners can: - Manage their printing shop profile - Manage services
and prices - Manage shop operating status - Manage the print queue and
orders - View and manage customer reviews - View shop activity and
earnings - Manage account settings

Admin Portal

Administrators can: - Manage and monitor registered users - Review and
verify printing shops - View submitted shop verification documents -
Monitor platform data and shop information

Technologies

Frontend

React

Vite

Tailwind CSS

MapLibre

Backend

Node.js

Express.js

MongoDB

Mongoose

Setup

Frontend

cd frontend
npm install
npm run dev

Backend

cd backend
npm install
npm start

Check the .env.example files in the frontend and backend folders for
the required environment variables.

Important

This repository contains the source code for academic/thesis reference.

Do not commit or share:

.env files

Database credentials

API keys

JWT secrets

node_modules/

Production build folders such as dist/

Uploaded/private files

Use the provided .env.example files as templates for local
configuration.

Authors

 Developer - Mahalalil P. Villaaflores
 Co-Reseachers: Wela Mae B. Lim
                Bernadette A. Elorza
                Ryan Fallore
