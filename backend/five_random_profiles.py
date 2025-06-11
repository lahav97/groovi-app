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
                SELECT id, username, full_name, bio, profile_picture, instruments, social_links, rating, genres, videos
                FROM users
                WHERE username != %s 
                ORDER BY RANDOM()
                LIMIT 5
            """, (requesting_username,))

            users = cur.fetchall()

            result = [
                {
                    "id": row[0],
                    "username": row[1],
                    "full_name": row[2],
                    "bio": row[3],
                    "profile_picture": row[4],
                    "instruments": row[5],
                    "social_links": row[6],
                    "rating": float(row[7]) if row[7] is not None else None,
                    "genres": row[8],
                    "videos": row[9]
                }
                for row in users
            ]

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
    print("Status Code:", response["statusCode"])
    print("Response Body:", json.dumps(json.loads(response["body"]), indent=2, ensure_ascii=False))