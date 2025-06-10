import json
import psycopg2
import os

# Database connection details until we get the env. varibles in the lambda
DB_HOST = "groovi-db-1.czwe08o8mo26.us-east-1.rds.amazonaws.com"
DB_NAME = "groovi_1"
DB_USER = "postgres"
DB_PASSWORD = "123456789"
DB_PORT = 5432

def lambda_handler(event, context):
    body = json.loads(event['body'])

    location = body.get("location")
    min_age = body.get("min_age")
    max_age = body.get("max_age")
    instrument = body.get("instrument")
    skill_level = body.get("skill_level")
    genres = body.get("genres")  # Expecting list of genres

    # Start SQL query and params list
    query = "SELECT id, username, age, location, instruments, genres FROM users WHERE TRUE"
    params = []

    # Add filters dynamically based on provided input
    if location:
        query += " AND location = %s"
        params.append(location)

    if min_age is not None:
        query += " AND age >= %s"
        params.append(min_age)

    if max_age is not None:
        query += " AND age <= %s"
        params.append(max_age)

    # Flexible instrument filter - can find also for any lavel
    if instrument and skill_level:
        query += " AND instruments @> %s::jsonb"
        params.append(json.dumps({instrument: skill_level}))
    elif instrument:
        query += " AND instruments ? %s"
        params.append(instrument)

    if genres:
        query += " AND genres && %s::text[]"
        params.append(genres)

    # Query execution
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        with conn.cursor() as cur:
            cur.execute(query, params)
            users = cur.fetchall()

            result = [
                {
                    "id": row[0],
                    "username": row[1],
                    "age": row[2],
                    "location": row[3],
                    "instruments": row[4],
                    "genres": row[5]
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
