# VinoScope — Interactive Wine Discovery & Recommendation Platform

## Project Overview

**VinoScope** is an interactive wine discovery website designed to help users explore wines, learn what characteristics they prefer, compare bottles, and receive personalized recommendations using a real similarity-based recommendation algorithm.

Rather than functioning as a direct alcohol retailer, VinoScope acts as a **discovery and indexing layer**. It stores structured information about wines and, where available, provides outbound links to major wine retailers so users can visit the original retailer page if they are interested in purchasing a bottle.

The project combines several computer science concepts:

- Web development
- Data collection and normalization
- Database design
- Search and filtering
- Recommendation systems
- Distance metrics
- Feature vectors
- Missing-data handling
- Ranking
- Explainable recommendations
- Entity matching / duplicate detection
- API design
- Data visualization
- Deployment and hosting

For the course project, the completed product would be a working website accompanied by the required written explanation describing the development process, research foundation, technical decisions, and lessons learned.

---

# Core Idea

The site should answer a simple problem:

> A user may know they want wine, but may not know what grape, region, bottle, or style they actually want.

VinoScope helps bridge that gap.

The user can either:

1. Browse a large wine collection manually.
2. Take a recommendation questionnaire.
3. Explore wines that match their calculated preference profile.
4. Compare multiple wines.
5. Explore similar wines.
6. Learn about wine characteristics, grapes, regions, and terminology.
7. Follow outbound retailer links for wines that interest them.

The recommendation engine should **not** rely primarily on hard-coded rules such as:

> "If user says steak, recommend Cabernet Sauvignon."

Instead, wines and users should both be represented as numerical feature vectors. The system calculates similarity between the user's preferences and wines in the database.

---

# Main Pages

## 1. Discover

The **Discover** page is the recommendation questionnaire.

Users answer questions about their preferences.

Possible questions include:

- Preferred wine type
  - Red
  - White
  - Rosé
  - Sparkling
  - No preference / unsure

- Sweetness
  - Very dry
  - Dry
  - Medium
  - Sweet
  - Very sweet
  - I'm unsure

- Body
  - Very light
  - Light
  - Medium
  - Full
  - Very full
  - I'm unsure

- Acidity
  - Low
  - Medium-low
  - Medium
  - Medium-high
  - High
  - I'm unsure

- Tannin
  - Low
  - Medium-low
  - Medium
  - Medium-high
  - High
  - I'm unsure

- Fruit profile
  - Light / fresh fruit
  - Red fruit
  - Dark fruit
  - Tropical fruit
  - Citrus
  - No preference
  - I'm unsure

- Price range
  - Under $15
  - $15–25
  - $25–40
  - $40–75
  - $75+
  - No preference

- Food pairing
  - Steak / beef
  - Chicken
  - Seafood
  - Pasta
  - Cheese
  - Spicy foods
  - Dessert
  - Drinking without food
  - Unsure

- Region preference
  - United States
  - France
  - Italy
  - Spain
  - Argentina
  - Australia
  - Other
  - No preference

Each subjective question should include:

> **I'm unsure / I don't know**

This is an important design and algorithmic feature.

The site should not force inexperienced users to guess.

---

# Handling "I'm Unsure"

An unknown answer should **not** be assigned the midpoint of a scale.

For example:

```text
Body:
1 = very light
2 = light
3 = medium
4 = full
5 = very full
```

If the user selects **"I'm unsure"**, it would be incorrect to store that answer as:

```text
body = 3
```

That would imply the user actively prefers medium-bodied wine.

Instead, unknown answers should be treated as **missing dimensions**.

Example wine vector:

```text
W = [sweetness, acidity, tannin, body, fruitiness]
W = [1, 4, 5, 5, 3]
```

Example user answers:

```text
Sweetness = 1
Acidity = unsure
Tannin = 4
Body = 5
Fruitiness = unsure
```

Conceptually:

```text
U = [1, ?, 4, 5, ?]
```

The recommendation algorithm ignores dimensions where the user has no preference.

This makes the recommendation system more accurate and avoids inventing preferences the user never expressed.

---

# User Wine Profile

After the questionnaire, the site should generate a readable user profile.

Example:

## Your Wine Profile

- Dry
- Full-bodied
- Medium-high acidity
- High tannin
- Dark-fruit leaning
- Primarily red wines
- Preferred price range: $20–40

This profile becomes the user's current preference vector.

The site can then display broader style matches first.

Example:

| Wine Style | Match |
|---|---:|
| Cabernet Sauvignon | 94% |
| Bordeaux Blend | 91% |
| Syrah | 86% |
| Malbec | 82% |

Below the style recommendations, the system displays actual bottles from the wine database.

This creates a useful two-stage recommendation model:

```text
User Preferences
      ↓
Wine Style Match
      ↓
Individual Bottle Match
```

This is more understandable than immediately recommending a single specific bottle with no context.

---

# Recommendation Algorithm

## Feature Vector Representation

Each wine can be represented using normalized numerical features.

Example:

```text
WineVector = [
    sweetness,
    acidity,
    tannin,
    body,
    fruitiness
]
```

A Cabernet Sauvignon might look like:

```text
[1, 3, 5, 5, 3]
```

A user preference vector might look like:

```text
[1, 4, 4, 5, 3]
```

---

# Basic Euclidean Distance

Similarity can initially be calculated using Euclidean distance.

\[
d(U,W)=\sqrt{\sum_{i=1}^{n}(U_i-W_i)^2}
\]

Smaller distance means a better match.

Example:

```text
User:  [1, 4, 4, 5, 3]
Wine:  [1, 3, 5, 5, 3]
```

The wines with the smallest distance values are ranked highest.

---

# Weighted Euclidean Distance

A better implementation is weighted Euclidean distance.

\[
d(U,W)=
\sqrt{
\frac{
\sum_i w_i(U_i-W_i)^2
}{
\sum_i w_i
}
}
\]

Where:

- `U_i` = user preference
- `W_i` = wine feature value
- `w_i` = importance of that feature

The denominator normalizes the score.

This matters because one user may answer three preference questions while another answers eight.

Without normalization, users answering fewer questions could produce scores on a different scale.

---

# Hard Constraints vs Soft Preferences

Not every answer needs to behave the same way.

Some answers should function as **hard filters**.

Example:

```text
User says:
"I only want red wine."
```

The system can remove non-red wines before similarity scoring.

Other preferences remain soft.

Example:

```text
User prefers high tannin.
```

A medium-high tannin wine can still appear, but it receives a slightly worse similarity score.

Possible hard constraints:

- Wine type
- Maximum price
- Minimum price
- Country restriction
- Vintage requirement
- Availability requirement

Possible soft preferences:

- Sweetness
- Acidity
- Tannin
- Body
- Fruit profile
- Food pairing compatibility

---

# Recommendation Pipeline

```text
User Answers
     ↓
Normalize Features
     ↓
Ignore Unknown Dimensions
     ↓
Apply Hard Filters
     ↓
Calculate Weighted Distance
     ↓
Rank Candidate Wines
     ↓
Convert Distance to Match Score
     ↓
Generate Explanation
     ↓
Return Recommendations
```

---

# Recommendation Explanations

Recommendations should explain themselves.

Example:

## 92% Match

**Why this matched**

- Full-bodied
- Very dry
- High tannin
- Dark-fruit profile
- Within your $20–40 price range
- Strong pairing with grilled beef

This turns the recommendation system into an **explainable recommendation engine** rather than a black box.

---

# "More Like This"

Each wine detail page should include:

> **More Like This**

The selected wine becomes the target vector.

The system calculates:

\[
d(W_{selected},W_i)
\]

for other wines in the database.

The same vector representation can therefore power:

- Questionnaire recommendations
- Similar wines
- Alternative bottles
- Wine substitutions
- Comparison tools
- Food pairing recommendations

This keeps the site's technical architecture consistent.

---

# 2. Explore

The **Explore** page is the searchable wine catalog.

The goal is to make a large scraped / manually collected wine dataset useful.

Possible filters:

- Wine type
- Winery
- Grape
- Country
- Region
- Vintage
- Price
- Rating
- Sweetness
- Body
- Acidity
- Tannin
- ABV
- Food pairing

Possible sorting:

- Best match
- Price low → high
- Price high → low
- Rating
- Vintage
- Winery
- Most similar to profile

Each wine card can show:

- Bottle image
- Wine name
- Winery
- Vintage
- Country / region
- Grape or blend
- Price range
- Rating
- Key characteristics
- Match percentage if the user has completed the questionnaire

---

# 3. Wine Detail Page

Each wine should have its own detail page.

Possible information:

- Wine name
- Bottle image
- Winery
- Vintage
- Grape / blend
- Country
- Region
- Subregion
- ABV
- Price
- External rating
- Description
- Tasting notes
- Aroma descriptors
- Food pairings
- Sweetness
- Acidity
- Tannin
- Body
- Fruit profile
- Similar wines
- Retailer links

Example characteristic visualization:

```text
Sweetness  ██░░░  2/5
Acidity    ████░  4/5
Tannin     █████  5/5
Body       █████  5/5
Fruit      ███░░  3/5
```

---

# Retailer Links

VinoScope should not need to process alcohol sales.

Instead, retailer listings are stored separately.

Example:

```text
Caymus Cabernet Sauvignon 2022

Available From:

Total Wine     $79.99
Wine.com       $84.99
Retailer C     $76.50
```

Clicking one redirects the user to the original retailer product page.

Suggested wording:

- View Retailer
- See Listing
- View Product
- Check Retailer

This keeps the site positioned as a discovery and comparison tool.

---

# 4. Pair

The **Pair** page helps users find wine for a specific food.

Examples:

- Steak
- Burgers
- Chicken
- Salmon
- Shellfish
- Pasta
- Pizza
- Spicy foods
- Cheese
- Chocolate
- Dessert

The system should eventually use the same scoring system rather than completely independent hard-coded logic.

Food categories can contribute weights to wine features.

Example:

```text
Steak Preference Vector

sweetness = 1
acidity   = 3
tannin    = 5
body      = 5
```

That vector can be combined with the user's normal preference vector.

---

# 5. Compare

Users can select approximately 2–4 wines and compare them side by side.

Compare:

- Price
- Vintage
- Winery
- Region
- Country
- Grape
- ABV
- Sweetness
- Acidity
- Tannin
- Body
- Fruit profile
- Food pairings
- Ratings

A radar chart could visualize:

- Body
- Tannin
- Acidity
- Sweetness
- Fruitiness

This makes differences between similar wines immediately visible.

---

# 6. Learn

The **Learn** page adds educational value.

Possible sections:

## Grapes

Examples:

- Cabernet Sauvignon
- Pinot Noir
- Merlot
- Syrah / Shiraz
- Malbec
- Chardonnay
- Sauvignon Blanc
- Riesling
- Pinot Grigio

Each grape page can explain:

- Typical body
- Typical acidity
- Typical tannin
- Common aromas
- Major producing regions
- Common food pairings

## Regions

Examples:

- Napa Valley
- Bordeaux
- Burgundy
- Tuscany
- Piedmont
- Rioja
- Mendoza
- Barossa Valley

## Wine Concepts

Explain:

- Tannin
- Acidity
- Body
- Sweetness
- Finish
- Aroma
- Bouquet
- Vintage
- Terroir
- Oak aging
- Malolactic fermentation

---

# Wine Data Collection

## Manual Collection Strategy

For the initial version, wine data can be collected manually from major online wine retailers.

Rather than immediately developing a large automated crawler, manually collecting a limited dataset has several advantages:

- Faster initial development
- Easier quality control
- Easier duplicate detection
- Easier verification
- Less time spent fighting anti-bot systems
- Better understanding of how retailers structure wine information
- Better fit for a course project

A realistic initial target could be:

```text
100–500 wines
```

A clean dataset of a few hundred wines is more useful than thousands of incomplete or inconsistent records.

Potential sources may include publicly visible pages from major wine retailers, winery websites, or other wine databases where use is permitted.

Data should be collected without attempting to bypass authentication, CAPTCHAs, rate limits, paywalls, or anti-bot protections. Retailer terms, robots policies, licensing restrictions, and image/description rights should be checked before automating collection.

For the course project, manual collection or small permitted imports are sufficient to demonstrate the concept.

---

# Manual Data Entry Workflow

A practical workflow:

```text
Retailer Product Page
       ↓
Copy Relevant Wine Data
       ↓
Enter Into CSV / JSON
       ↓
Run Cleaning Script
       ↓
Normalize Fields
       ↓
Detect Potential Duplicates
       ↓
Import Into PostgreSQL
```

Example CSV:

```csv
name,winery,vintage,grape,country,region,type,price,abv,source_url
Caymus Cabernet Sauvignon,Caymus Vineyards,2022,Cabernet Sauvignon,USA,Napa Valley,Red,79.99,14.6,https://...
```

A Python import script can later transform raw records into normalized database objects.

---

# Future Automated Data Collection

If the project is expanded later, source-specific importers could be developed.

Architecture:

```text
Retailer A Importer
Retailer B Importer
Retailer C Importer
        ↓
Raw Wine Records
        ↓
Normalization Pipeline
        ↓
Duplicate Detection
        ↓
Canonical Wine Database
```

Each importer would translate source-specific fields into a shared schema.

Automated scraping should only be used where permitted and should follow source terms and technical restrictions.

---

# Data Provenance

Every imported record should preserve its source.

Recommended fields:

```text
source_site
source_url
source_product_id
collected_at
last_verified_at
```

This helps:

- Debugging
- Updating prices
- Avoiding duplicate imports
- Proper attribution
- Tracking stale data
- Explaining project methodology

---

# Wine vs Retailer Listing

Wine information and retailer listings should be separate database entities.

## Wine

Represents the actual wine.

```text
Wine
----
id
name
winery_id
vintage
grape
country
region
subregion
type
abv
sweetness
acidity
tannin
body
fruitiness
description
image_url
```

## RetailerListing

Represents one retailer's listing for that wine.

```text
RetailerListing
---------------
id
wine_id
retailer_id
price
currency
product_url
availability
source_product_id
collected_at
last_verified_at
```

This allows one wine to have multiple purchase options without duplicating the wine itself.

---

# Entity Matching / Duplicate Detection

Different retailers may refer to the same bottle differently.

Example:

```text
Caymus Cabernet Sauvignon 2022
Caymus Vineyards Cabernet 2022
2022 Caymus Napa Valley Cabernet Sauvignon
Caymus Napa Cabernet Sauvignon 750ml 2022
```

These should ideally become one canonical wine record.

Initial normalization can include:

```text
lowercase text
remove punctuation
remove bottle size
normalize whitespace
extract vintage
normalize winery names
normalize grape names
normalize regions
```

Possible matching signals:

- Winery
- Vintage
- Grape
- Region
- Bottle name
- Product title similarity

---

# Fuzzy Matching

A later version can use fuzzy string matching.

Useful Python libraries:

```text
rapidfuzz
```

Example approach:

```python
name_score = fuzz.token_set_ratio(a.name, b.name)
winery_score = fuzz.token_set_ratio(a.winery, b.winery)

if (
    name_score > 90
    and winery_score > 90
    and a.vintage == b.vintage
):
    possible_duplicate = True
```

Potential duplicates should ideally be reviewed manually before merging.

---

# Suggested Database Schema

## wineries

```text
id
name
country
region
website
```

## wines

```text
id
winery_id
name
vintage
type
country
region
subregion
abv
sweetness
acidity
tannin
body
fruitiness
description
image_url
created_at
updated_at
```

## grapes

```text
id
name
```

## wine_grapes

```text
wine_id
grape_id
percentage
```

## retailers

```text
id
name
website
```

## retailer_listings

```text
id
wine_id
retailer_id
price
currency
product_url
availability
source_product_id
collected_at
last_verified_at
```

## food_pairings

```text
id
name
category
```

## wine_food_pairings

```text
wine_id
food_pairing_id
score
```

---

# Recommended Tech Stack

## Frontend

### React

Recommended frontend framework:

```text
React
TypeScript
Vite
```

Reasons:

- Fast development
- Component-based architecture
- Excellent ecosystem
- Easy filtering and dynamic interfaces
- Strong visualization support
- Familiar technology

Optional styling:

```text
Tailwind CSS
```

Possible component libraries:

```text
shadcn/ui
Radix UI
Material UI
```

A relatively custom visual design would probably fit the project better than making it look like a generic dashboard.

---

# Frontend Libraries

Possible libraries:

## Routing

```text
react-router-dom
```

## API Requests

```text
fetch
```

or:

```text
axios
```

## Server State

Optional:

```text
TanStack Query
```

## Charts

Possible:

```text
Recharts
Chart.js
```

Useful for:

- Radar comparisons
- Distribution charts
- Wine profile visualization

---

# Backend

Recommended:

```text
Python
FastAPI
```

Reasons:

- Simple REST APIs
- Good performance
- Automatic API documentation
- Easy connection to recommendation logic
- Excellent Python ecosystem for data processing
- Easy integration with Pandas / NumPy / RapidFuzz

---

# Backend Libraries

Suggested:

```text
fastapi
uvicorn
sqlalchemy
psycopg
pydantic
numpy
pandas
rapidfuzz
alembic
```

Optional:

```text
scikit-learn
```

Scikit-learn is not required for the first recommendation algorithm, but could later support:

- Nearest neighbors
- Clustering
- Feature scaling
- Recommendation experiments

---

# Database

Recommended:

```text
PostgreSQL
```

Reasons:

- Strong relational modeling
- Excellent filtering
- Good full-text search
- Reliable
- Easy deployment
- Well suited for wine + retailer relationships

Potential future extension:

```text
pgvector
```

This could support embedding-based similarity if the project later includes text embeddings for descriptions or tasting notes.

That is not required for the initial implementation.

---

# Development Architecture

```text
Browser
   ↓
React + TypeScript
   ↓
FastAPI REST API
   ↓
Recommendation Service
   ↓
SQLAlchemy
   ↓
PostgreSQL
```

Separate ingestion path:

```text
CSV / JSON / Manual Data
          ↓
Python Import Scripts
          ↓
Normalization
          ↓
Duplicate Detection
          ↓
PostgreSQL
```

---

# Suggested Repository Structure

```text
vinoscope/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── recommendation/
│   │   └── database/
│   └── requirements.txt
│
├── data/
│   ├── raw/
│   ├── cleaned/
│   └── imports/
│
├── scripts/
│   ├── import_wines.py
│   ├── normalize_wines.py
│   └── find_duplicates.py
│
├── docker-compose.yml
└── README.md
```

---

# API Design

Possible endpoints:

## Wines

```text
GET /api/wines
GET /api/wines/{id}
GET /api/wines/{id}/similar
```

## Search

```text
GET /api/search
```

Example:

```text
/api/wines?type=red&country=USA&max_price=40
```

## Recommendations

```text
POST /api/recommendations
```

Request:

```json
{
  "sweetness": 1,
  "acidity": null,
  "tannin": 4,
  "body": 5,
  "fruitiness": null,
  "max_price": 40,
  "type": "red"
}
```

Response:

```json
{
  "profile": {
    "description": [
      "dry",
      "full-bodied",
      "high tannin"
    ]
  },
  "recommendations": [
    {
      "wine_id": 102,
      "match_score": 0.94
    }
  ]
}
```

---

# Feature Normalization

Different attributes must use compatible scales.

Recommended initial scale:

```text
1–5
```

Example:

```text
sweetness: 1–5
acidity:   1–5
tannin:    1–5
body:      1–5
fruitiness:1–5
```

Categorical values should either:

1. Be used as filters, or
2. Be encoded separately.

Avoid assigning arbitrary numerical meaning to categories such as country.

For example:

```text
France = 1
Italy = 2
USA = 3
```

would incorrectly imply numerical relationships between countries.

---

# Match Score Conversion

Raw Euclidean distance is useful internally but confusing to users.

The backend can transform distance into an approximate match score.

One simple approach:

\[
score = \frac{1}{1+d}
\]

Then convert to a percentage.

Another approach is to normalize against the maximum possible distance.

The exact scoring method should be documented so the percentage is interpretable rather than arbitrary.

---

# Search Implementation

Initial search can use PostgreSQL.

Search fields:

- Wine name
- Winery
- Grape
- Region
- Country

Later improvements:

- PostgreSQL full-text search
- Trigram search
- Typo tolerance

PostgreSQL extension:

```text
pg_trgm
```

This could allow searches like:

```text
cab sav
```

to still find:

```text
Cabernet Sauvignon
```

---

# Authentication

Authentication is optional for the class-project version.

The first version can store the wine profile in:

```text
localStorage
```

This avoids unnecessary account complexity.

Future account features could include:

- Saved wines
- Favorites
- Personal tasting journal
- Saved wine profile
- Recommendation history
- Cellar inventory

---

# Possible Future Feature: Tasting Journal

Users could record:

```text
Wine
Date tasted
Rating
Sweetness
Acidity
Tannin
Body
Aromas
Personal notes
Would buy again?
```

This creates user-specific data that could improve future recommendations.

Instead of asking only:

> What do you think you like?

the system could eventually learn from:

> What have you actually rated highly?

---

# Possible Future Recommendation Upgrade

The initial system is **content-based recommendation**.

It compares wine attributes directly.

Future options:

## Collaborative Filtering

Recommend wines liked by users with similar tastes.

## Hybrid Recommender

Combine:

```text
Content Similarity
+
User Ratings
+
Popularity
+
Food Context
```

## Embedding Similarity

Generate vector embeddings from tasting notes and wine descriptions.

Possible architecture:

```text
Wine Description
      ↓
Embedding Model
      ↓
Vector
      ↓
pgvector
      ↓
Semantic Similarity
```

This is outside the necessary course scope but provides a clear expansion path.

---

# User Interface Direction

The design should feel like a polished wine discovery application rather than an online spreadsheet.

Possible visual direction:

- Dark burgundy / cream / charcoal palette
- Large bottle imagery
- Serif typography for wine names
- Sans-serif typography for interface elements
- Region badges
- Elegant characteristic charts
- Minimal card design
- Strong photography
- Interactive recommendation profile

The design should still prioritize usability over decorative complexity.

---

# Home Page

Possible sections:

```text
Hero
"Find a wine you'll actually enjoy."

[Discover Your Wine Profile]

Popular Wines
Explore by Grape
Explore by Region
Pair Wine With Food
How VinoScope Recommendations Work
```

---

# Initial MVP

The first working version should focus on:

1. PostgreSQL wine database
2. Manual dataset of approximately 100–500 wines
3. Explore page
4. Wine detail pages
5. Questionnaire
6. User wine profile
7. Weighted distance recommendation system
8. "I'm unsure" handling
9. Ranked recommendation results
10. Outbound retailer links

This is already a substantial project.

---

# Phase 2

Add:

- Wine comparison
- Similar wines
- Food pairing
- Better search
- Duplicate detection
- Multiple retailer listings
- Charts
- Region and grape learning pages

---

# Phase 3

Possible extensions:

- Accounts
- Saved wines
- Tasting journal
- Personalized recommendation history
- Collaborative filtering
- Embedding search
- Automated allowed importers
- Price history
- Availability tracking
- Cellar management

---

# Temporary Hosting / Deployment

Several deployment approaches are realistic.

## Option 1 — Vercel + Render / Railway + Managed PostgreSQL

Frontend:

```text
Vercel
```

Backend:

```text
Render
```

or:

```text
Railway
```

Database:

```text
Neon PostgreSQL
Supabase PostgreSQL
Railway PostgreSQL
```

Advantages:

- Simple
- Public URL quickly
- Minimal infrastructure management
- Good for a temporary course project

Architecture:

```text
Vercel
React Frontend
      ↓
Render / Railway
FastAPI Backend
      ↓
Managed PostgreSQL
```

This is probably the easiest temporary public deployment.

---

# Option 2 — Single VPS

Possible providers:

```text
DigitalOcean
Hetzner
Linode / Akamai
Vultr
```

Run:

```text
Docker Compose
```

Services:

```text
frontend
backend
postgres
nginx
```

Example:

```text
Internet
   ↓
Nginx
   ├── /       → React frontend
   └── /api    → FastAPI
                 ↓
              PostgreSQL
```

Advantages:

- Full control
- Good learning experience
- Cheap
- Easy to move elsewhere later

Disadvantages:

- More server administration
- HTTPS, updates, firewall, backups, and monitoring become your responsibility

---

# Option 3 — Self-Hosted Temporarily

The project could also be temporarily hosted on existing personal infrastructure.

Possible architecture:

```text
Cloudflare
    ↓
Cloudflare Tunnel / Reverse Proxy
    ↓
Docker Host / VM
    ↓
Frontend + FastAPI + PostgreSQL
```

Advantages:

- No additional hosting cost
- Full control
- Good technical demonstration

Important considerations:

- Keep the database private
- Expose only the web/API services
- Use HTTPS
- Use environment variables for credentials
- Back up PostgreSQL
- Avoid exposing PostgreSQL directly to the Internet

---

# Recommended Deployment for the Course Project

The simplest deployment is probably:

```text
Frontend: Vercel
Backend: Render or Railway
Database: Neon PostgreSQL
```

If keeping everything under one controlled infrastructure is preferred:

```text
Docker Compose
+
Nginx
+
FastAPI
+
React
+
PostgreSQL
```

on a small VPS or existing server is also straightforward.

---

# Docker Development

A local development environment could use Docker Compose.

Example services:

```yaml
services:

  postgres:
    image: postgres:17

  backend:
    build: ./backend

  frontend:
    build: ./frontend
```

This keeps development and deployment consistent.

Environment variables:

```text
DATABASE_URL
API_BASE_URL
APP_ENV
```

Retailer data sources and other configuration can also be stored in environment/configuration files rather than hard-coded.

---

# Security Basics

Even for a class project:

- Do not commit secrets to Git.
- Use `.env` files locally.
- Add `.env` to `.gitignore`.
- Keep PostgreSQL inaccessible from the public Internet where possible.
- Validate API input.
- Sanitize/filter query parameters.
- Restrict CORS to the deployed frontend.
- Use HTTPS.
- Avoid blindly rendering scraped HTML.
- Store outbound URLs as data rather than executable content.

---

# Data Quality Problems to Expect

Real-world wine data will not be clean.

Likely problems:

- Missing vintages
- Different spelling
- Different winery names
- Mixed units
- Bottle size included in names
- Different prices
- Missing ABV
- Missing grape percentages
- Blends represented differently
- Regional naming differences
- Duplicate products
- Different descriptions for the same wine

Handling these problems is part of what makes the project technically interesting.

---

# Research / Written Component Topics

The written report could discuss:

## Motivation

Many casual wine buyers do not know enough terminology to search effectively.

## Data Collection

How wine records were collected and normalized.

## Recommendation Design

Why a similarity-based recommendation system was chosen.

## Missing Preferences

Why "I'm unsure" is treated as missing data instead of a neutral midpoint.

## Distance Metrics

How weighted Euclidean distance ranks wines.

## Database Design

Why wines and retailer listings are separate entities.

## Duplicate Detection

Why retailer naming inconsistencies create an entity-resolution problem.

## UI Design

How complex wine characteristics were presented in an understandable way.

## Lessons Learned

Possible topics:

- Recommendation systems depend heavily on feature design.
- Real-world data requires substantial cleaning.
- Missing data must be handled deliberately.
- Data modeling matters as much as frontend design.
- Explainability improves recommendation usability.

---

# Why This Project Is Strong

The project has a visible, polished final product while also containing substantial technical depth.

It is more than a static wine website.

It includes:

```text
Web Application
+
Wine Dataset
+
Search Engine
+
Recommendation Algorithm
+
User Preference Modeling
+
Missing-Data Handling
+
Entity Resolution
+
Database Design
+
Retailer Indexing
+
Data Visualization
```

The same feature-vector model can support multiple features across the site:

```text
Questionnaire
        ↓
User Profile
        ↓
Recommendations

Selected Wine
        ↓
Similarity Engine
        ↓
More Like This

Food
        ↓
Pairing Vector
        ↓
Recommended Wines

Wine A + Wine B
        ↓
Feature Comparison
        ↓
Visualization
```

That gives VinoScope a coherent technical foundation rather than a collection of unrelated features.

---

# Recommended Final Scope

For the actual course submission, prioritize:

## Required / Core

- Home
- Discover questionnaire
- "I'm unsure" handling
- User wine profile
- Recommendation engine
- Explore catalog
- Wine detail pages
- Retailer outbound links
- Database
- Manual wine data collection
- Weighted similarity scoring

## Strong Additions

- Compare
- Similar wines
- Food pairing
- Radar charts
- Duplicate detection
- Search improvements

## Future / Optional

- Accounts
- Tasting journal
- Automated permitted importers
- Collaborative filtering
- Embedding search
- Price tracking
- Cellar management

This scope keeps the project achievable while still making the finished product technically substantial and visually impressive.
