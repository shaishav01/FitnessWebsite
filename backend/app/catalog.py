"""Single source of truth for services and membership plans.

The public pricing section is rendered from this file via /api/public/catalog,
and the sample data uses the same plan ids/prices. Edit here to change pricing.
"""

SERVICES = [
    {"id": "cardio", "name": "Cardio Arena"},
    {"id": "zumba", "name": "Zumba & Aerobics"},
    {"id": "strength", "name": "Strength Gym"},
    {"id": "steam", "name": "Steam Bath"},
    {"id": "trainers", "name": "Personal Trainers"},
    {"id": "diet", "name": "Diet Plans"},
    {"id": "food", "name": "Healthy Food Court"},
]

# `services` maps service id -> what the plan includes. Missing id = not covered.
PLANS = [
    {
        "id": "spark",
        "name": "Spark",
        "tagline": "Start moving. Zero fluff.",
        "price_inr": 1499,
        "period": "month",
        "highlight": False,
        "services": {
            "cardio": "Unlimited access",
            "zumba": "4 classes / month",
            "strength": "Unlimited access",
        },
    },
    {
        "id": "surge",
        "name": "Surge",
        "tagline": "Train, sweat, recover, refuel.",
        "price_inr": 2999,
        "period": "month",
        "highlight": True,
        "services": {
            "cardio": "Unlimited access",
            "zumba": "Unlimited classes",
            "strength": "Unlimited access",
            "steam": "8 sessions / month",
            "food": "10% off every meal",
        },
    },
    {
        "id": "apex",
        "name": "Apex",
        "tagline": "The full Kinetra experience.",
        "price_inr": 5499,
        "period": "month",
        "highlight": False,
        "services": {
            "cardio": "Unlimited access",
            "zumba": "Unlimited classes",
            "strength": "Unlimited access",
            "steam": "Unlimited sessions",
            "trainers": "8 one-on-one sessions / month",
            "diet": "Custom plan, reviewed monthly",
            "food": "20% off every meal",
        },
    },
]

PLAN_PRICES = {p["id"]: p["price_inr"] for p in PLANS}

GOALS = [
    {"id": "fat_loss", "label": "Lose fat"},
    {"id": "muscle_gain", "label": "Build muscle"},
    {"id": "strength", "label": "Get stronger"},
    {"id": "stamina", "label": "Improve stamina"},
    {"id": "general", "label": "General fitness"},
    {"id": "rehab", "label": "Recovery / rehab"},
]
GOAL_LABELS = {g["id"]: g["label"] for g in GOALS}
PLAN_NAMES = {p["id"]: p["name"] for p in PLANS}
