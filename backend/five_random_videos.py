import json
import os
import psycopg2
import random

# Database connection details until we get the env. varibles in the lambda
DB_HOST = "groovi-db-1.czwe08o8mo26.us-east-1.rds.amazonaws.com"
DB_NAME = "groovi_1"
DB_USER = "postgres"
DB_PASSWORD = "123456789"
DB_PORT = 5432


def lambda_handler(event, context):
    # Parse username from request
    try:
        body = json.loads(event['body'])
        requesting_username = body['username']
    except (KeyError, TypeError, json.JSONDecodeError):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid input. Expected a JSON body with 'username' field."}),
            "headers": {"Content-Type": "application/json"}
        }

    conn = psycopg2.connect(
        host=DB_HOST,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT
    )

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, videos, instruments
                FROM users
                WHERE username != %s AND videos IS NOT NULL AND array_length(videos, 1) > 0
                ORDER BY RANDOM()
                LIMIT 5
            """, (requesting_username,))
            users = cur.fetchall()

            result = []

            for user_id, username, videos, instruments in users:
                if videos:
                    random_video = random.choice(videos)

                    # Extract just the instrument names (keys of the dict)
                    instrument_names = list(instruments.keys()) if instruments else []

                    result.append({
                        "user_id": user_id,
                        "username": username,
                        "video_url": random_video,
                        "instruments": instrument_names
                    })

        return {
            "statusCode": 200,
            "body": json.dumps(result, ensure_ascii=False),  # alllow non-ASCII characters like ó for Cajón in instruments
            "headers": {"Content-Type": "application/json; charset=utf-8"}
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

    finally:
        conn.close()


# Local testing
if __name__ == "__main__":
    test_event = {
        "body": json.dumps({
            "username": "lahav97"
        })
    }
    response = lambda_handler(test_event, None)
    print(response)