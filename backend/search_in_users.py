import json
import psycopg2
import os

# Database connection details until we get the env. varibles in the lambda
DB_HOST = "groovi-db-1.czwe08o8mo26.us-east-1.rds.amazonaws.com"
DB_NAME = "groovi_1"
DB_USER = "postgres"
DB_PASSWORD = "123456789"
DB_PORT = 5432

# Only allow these fields to be searched
ALLOWED_FIELDS = {"email", "username"}


def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        field = body.get("field")
        value = body.get("value")

        if field not in ALLOWED_FIELDS:
            return {
                "statusCode": 400,
                "body": json.dumps({"message": f"Invalid field: {field}"})
            }

        if not value:
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "Value is required."})
            }

        conn = psycopg2.connect(
            host=DB_HOST,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cursor = conn.cursor()

        query = f"SELECT 1 FROM users WHERE {field} = %s LIMIT 1;"
        cursor.execute(query, (value,))
        result = cursor.fetchone()

        cursor.close()
        conn.close()

        return {
            "statusCode": 200,
            "body": json.dumps({"found": bool(result)})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }


# Local testing
if __name__ == "__main__":

    # Example 1: test by email
    test_event_email = {
        "body": json.dumps({
            "field": "email",
            "value": "margi.official@gmail.com"
        })
    }

    # Example 2: test by username
    # test_event_username = {
    #    "body": json.dumps({
    #        "field": "username",
    #        "value": "lahav77"
    #   })
    # }

    print("=== Test by Email ===")
    print(lambda_handler(test_event_email, None))

    # print("\n=== Test by Username ===")
    # print(lambda_handler(test_event_username, None))

