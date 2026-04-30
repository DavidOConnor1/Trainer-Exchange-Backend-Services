# Pokémon TCG Backend

[![CI/CD Pipeline](https://github.com/DavidOConnor1/Trainer-Exchange-Backend-Services/actions/workflows/deploy.yml/badge.svg)](https://github.com/DavidOConnor1/Trainer-Exchange-Backend-Services/actions/workflows/deploy.yml)
[![Deployed](https://img.shields.io/badge/Deployed-Railway-blue)](https://trainer-exchange-backend-services-production.up.railway.app/health)
[![Tests](https://img.shields.io/badge/Tests-180%20passing-brightgreen)](https://github.com/DavidOConnor1/Trainer-Exchange-Backend-Services/actions)
[![Node.js](https://img.shields.io/badge/Node.js-22-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Build-blue)](https://railway.app)

# Overview

A production-ready REST API for Pokémon Trading Card Game data, providing card search, pricing information, set management, and batch operations. Built with Node.js, Express, and the TCGdex SDK. 
# Features
## Card Search & Data

    Search cards by name, type, set, rarity, and HP range

    Retrieve cards by localId (card number) or set + localId combination

    Pagination support (default 20 cards per page)

    Cardmarket pricing (30-day average and trend prices)

## Batch Operations

    Fetch multiple cards by SDK IDs or localIds in a single request

## Set Management

    Get all card sets with series information

    Retrieve all cards within a specific set (with pagination)

    Filter cards by type (Fire, Water, Grass, etc.)

## Security

    JWT-based API key authentication for protected routes

    Rate limiting (100 requests/15min global, 30/min search, 10/min admin)

    Request timeout (10s) and payload size limits (1mb)

    Security headers (Helmet, CORS, XSS protection)

    Request ID tracing for every API call

## Monitoring

    Health check endpoint

    API metrics and performance statistics

    Security monitoring and abuse detection

    Cache performance tracking

    Active alert system

    HTML monitoring dashboard

# API Endpoints
Public Routes (No Authentication)
Method	Endpoint	Description
GET	/health	Health check
GET	/api/status	API status and metrics
GET	/api/search	Search cards (name, type, set, rarity, HP)
GET	/api/cards/:localId	Get card by localId (card number)
GET	/api/cards/:setId/:localId	Get card by set + localId
GET	/api/sets	Get all card sets
GET	/api/sets/:setId/cards	Get cards by set
GET	/api/sets/type/:type/cards	Get cards by type
POST	/api/batch/cards	Batch fetch cards by SDK IDs
POST	/api/batch/cards/by-localid	Batch fetch cards by localIds

# Installation
# Clone the repository
git clone https://github.com/DavidOConnor1/Trainer-Exchange-Backend-Services.git
cd Trainer-Exchange-Backend-Services/services

# Install dependencies
npm ci

# Create environment file
cp .env.example .env

# Start development server
npm run dev

# Contributing

    Fork the repository

    Create a feature branch (git checkout -b feature/amazing)

    Commit changes (git commit -m 'Add amazing feature')

    Push to branch (git push origin feature/amazing)

    Open a Pull Request

# Acknowledgements
- TCGdex SDK for Pokémon card data

- Railway for hosting

- Pokémon for the amazing cards
