import psycopg2
import os
import json

# Database connection details until we get the env. varibles in the lambda
DB_HOST = "groovi-db-1.czwe08o8mo26.us-east-1.rds.amazonaws.com"
DB_NAME = "groovi_1"
DB_USER = "postgres"
DB_PASSWORD = "123456789"
DB_PORT = 5432


def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        search_term = body.get("query", "").strip()

        if not search_term:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Query parameter is required."})
            }

        conn = psycopg2.connect(
            host=DB_HOST,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cursor = conn.cursor()

        # Build match patterns
        exact = search_term
        starts_with = f"{search_term}%"
        contains = f"%{search_term}%"

        cursor.execute("""
            SELECT id, username, full_name, bio, profile_picture, instruments, social_links, rating, genres, videos,
                   CASE
                     WHEN username ILIKE %s OR full_name ILIKE %s THEN 1
                     WHEN username ILIKE %s OR full_name ILIKE %s THEN 2
                     ELSE 3
                   END AS rank
            FROM users
            WHERE username ILIKE %s OR full_name ILIKE %s
            ORDER BY rank, username
            LIMIT 10;
        """, (exact, exact, starts_with, starts_with, contains, contains))

        users = cursor.fetchall()

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
            "body": json.dumps(result, ensure_ascii=False)
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()


# 🔍 Local testing
if __name__ == "__main__":
    test_event = {
        "body": json.dumps({
            "query": "ed"
        })
    }
    response = lambda_handler(test_event, None)
    print("Status Code:", response["statusCode"])
    print("Response Body:", json.dumps(json.loads(response["body"]), indent=2, ensure_ascii=False))
