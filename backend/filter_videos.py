import json
import psycopg2
import os
import random

# Database connection details until we get the env. varibles in the lambda
DB_HOST = "groovi-db-1.czwe08o8mo26.us-east-1.rds.amazonaws.com"
DB_NAME = "groovi_1"
DB_USER = "postgres"
DB_PASSWORD = "123456789"
DB_PORT = 5432


def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        username = body['username']
    except Exception as e:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing or invalid 'username' in request body."})
        }

    # Optional filters if sent from UI
    location = body.get('location')
    min_age = body.get('min_age')
    max_age = body.get('max_age')
    instruments = body.get('instruments')  # Example: {"Guitar": "Advanced", "Drums": null}
    genres = body.get('genres')

    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cur = conn.cursor()

        result = []

        # If no filters: show 5 random videos
        if not any([location, min_age, max_age, instruments, genres]):
            cur.execute("""
                SELECT id, username, videos, profile_picture, instruments
                FROM users
                WHERE username != %s
                  AND videos IS NOT NULL
                  AND array_length(videos, 1) > 0
                ORDER BY RANDOM()
                LIMIT 3
            """, (username,))
        else:
            query = """
                SELECT id, username, videos, profile_picture, instruments
                FROM users
                WHERE username != %s
                  AND videos IS NOT NULL
                  AND array_length(videos, 1) > 0
            """
            params = [username]

            if location:
                query += " AND location = ANY(%s)"
                params.append(location)

            if min_age is not None:
                query += " AND age >= %s"
                params.append(min_age)

            if max_age is not None:
                query += " AND age <= %s"
                params.append(max_age)

            # OR-based instrument filter
            if instruments:
                instrument_clauses = []
                for inst, level in instruments.items():
                    if level is None or str(level).lower() == "any":
                        instrument_clauses.append("instruments ? %s")  # check if key exists (any skill)
                        params.append(inst)
                    else:
                        instrument_clauses.append("instruments @> %s::jsonb")  # check for key + value match
                        params.append(json.dumps({inst: level}))

                if instrument_clauses:
                    query += " AND (" + " OR ".join(instrument_clauses) + ")"

            if genres:
                query += " AND genres && %s::text[]"
                params.append(genres)

            query += " ORDER BY RANDOM() LIMIT 3"
            cur.execute(query, params)

        users = cur.fetchall()

        result = [
             {
                 "id": row[0],
                 "username": row[1],
                 "video_url": random.choice(row[2]) if row[2] else None,  # pick a random video URL
                 # "profile_picture": row[3],
                 "instruments": list(row[4].keys()) if row[4] else [],  # to return just the instrument names no skill
             }
             for row in users
        ]

        return {
            "statusCode": 200,
            "body": json.dumps(result, ensure_ascii=False),
            "headers": {"Content-Type": "application/json; charset=utf-8"}
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

    finally:
        if conn:
            conn.close()


# --- Local testing block ---
if __name__ == "__main__":
    test_event = {
        "body": json.dumps({
            "username": "lahav97",
            # Uncomment any filters below to test them
            # "location": ["Tel Aviv", "Haifa"],
            # "min_age": 20,
            # "max_age": 35,
            # "genres": ["Rock", "Jazz"],
            "genres": ["Indie"],
            # "instruments": {
            #     "Guitar": "Advanced",
            #     "Drums": None
            # }
        })
    }

    response = lambda_handler(test_event, None)

    print("Status Code:", response["statusCode"])
    print("Response Body:")
    try:
        parsed = json.loads(response["body"])
        print(json.dumps(parsed, indent=2, ensure_ascii=False))
    except Exception:
        print(response["body"])