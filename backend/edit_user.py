import json
import psycopg2
import os
from datetime import datetime, date

# Database connection details until we get the env. varibles in the lambda
DB_HOST = "groovi-db-1.czwe08o8mo26.us-east-1.rds.amazonaws.com"
DB_NAME = "groovi_1"
DB_USER = "postgres"
DB_PASSWORD = "123456789"
DB_PORT = 5432

# Fields allowed to be updated
ALLOWED_FIELDS = {
    "phone_number", "address", "profile_picture",
    "bio", "social_links", "instruments", "rating",
    "genres", "videos", "full_name", "gender"
}

# Fields that can be used to identify the user
IDENTIFIERS = {"username", "email"}


def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])

        # searches for the first field in IDENTIFIERS that exists in the body of the request.
        identifier_field = next((field for field in IDENTIFIERS if field in body), None)
        if not identifier_field:
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "Must provide 'username' or 'email' to identify user."}),
                "headers": {"Content-Type": "application/json; charset=utf-8"}
            }

        identifier_value = body.pop(identifier_field)

        # Builds a new dictionary of only the fields in ALLOWED_FIELDS
        update_fields = {key: value for key, value in body.items() if key in ALLOWED_FIELDS}
        if not update_fields:
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "No valid fields to update."}),
                "headers": {"Content-Type": "application/json; charset=utf-8"}
            }

        # Prepare SQL
        set_clause = ", ".join(f"{key} = %s" for key in update_fields)  # e.g., "field1 = %s, field2 = %s"
        values = list(update_fields.values())                           # e.g., [value1, value2]
        values.append(identifier_value)                                 # e.g., [value1, value2, identifier_value] for WHERE clause

        query = f"UPDATE users SET {set_clause} WHERE {identifier_field} = %s RETURNING *;"

        # DB operation
        conn = psycopg2.connect(
            host=DB_HOST,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cursor = conn.cursor()
        cursor.execute(query, values)
        updated_row = cursor.fetchone()
        column_names = [desc[0] for desc in cursor.description]
        conn.commit()
        cursor.close()
        conn.close()

        if not updated_row:
            return {
                "statusCode": 404,
                "body": json.dumps({"message": "User not found."}),
                "headers": {"Content-Type": "application/json; charset=utf-8"}
            }

        updated_user = dict(zip(column_names, updated_row))
        updated_user.pop("password", None)

        # Convert dates to ISO format
        for key, val in updated_user.items():
            if isinstance(val, (datetime, date)):
                updated_user[key] = val.isoformat()

        return {
            "statusCode": 200,
            "body": json.dumps(updated_user, ensure_ascii=False, default=str),
            "headers": {"Content-Type": "application/json; charset=utf-8"}
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
            "headers": {"Content-Type": "application/json; charset=utf-8"}
        }


if __name__ == "__main__":
    test_event = {
        "body": json.dumps({
            "username": "ed_sheeran",
            "gender": "male"
        })
    }

    response = lambda_handler(test_event, None)
    print("=== Lambda Response ===")
    print(response)
