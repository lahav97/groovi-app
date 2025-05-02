# get_all_users.py
import psycopg2
import json
import os

# Database connection details
DB_HOST = "database-1.cy2tiqi5hhhj.us-east-1.rds.amazonaws.com"
DB_NAME = "testone"
DB_USER = "postgres"
DB_PASSWORD = "123456789"
DB_PORT = 5432


def lambda_handler(event, context):
    try:
        # Connect to the database
        conn = psycopg2.connect(
            host=DB_HOST,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cursor = conn.cursor()

        # Query to select all users
        query = "SELECT id, username, email, instruments, genres, rating, user_type FROM users;"
        cursor.execute(query)
        rows = cursor.fetchall()

        # Columns we selected
        columns = ['id', 'username', 'email', 'instruments', 'genres', 'rating', 'user_type']

        # Build a list of dictionaries
        users = []
        for row in rows:
            users.append(dict(zip(columns, row)))

        # Close connection
        cursor.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'  # So mobile app can access
            },
            'body': json.dumps(users, default=str)
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


if __name__ == "__main__":
    event = {
        "body": None,
        "httpMethod": "GET",
        "queryStringParameters": None
    }
    response = lambda_handler(event, None)
    print(response)
