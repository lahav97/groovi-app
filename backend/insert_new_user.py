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
    # Parse JSON input
    try:
        body = json.loads(event['body'])
        username = body['username']
        full_name = body['full_name']
        phone_number = body['phone_number']
        email = body['email']
        address = body['address']
        password = body['password']
        profile_picture = body.get('profile_picture', None)
        bio = body.get('bio', None)
        social_links = body.get('social_links', None)
        instruments = body.get('instruments', [])
        rating = body.get('rating', None)
        user_type = body['user_type']
        genres = body.get('genres', [])
        videos = body.get('videos', [])  # NEW: get videos list from input, default empty
    except Exception as e:
        return {
            'statusCode': 400,
            'body': f"Invalid input: {e}"
        }
    # Convert instruments to JSON string if dict
    if isinstance(instruments, dict) or isinstance(instruments, list):
        instruments = json.dumps(instruments)

    # Connect to the database and insert
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cursor = conn.cursor()

        # Insert into users table and get the user_id
        insert_user_query = """
        INSERT INTO users (username, full_name, phone_number, email, address, password, profile_picture, bio, social_links, instruments, rating, user_type, genres, videos )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """

        cursor.execute(insert_user_query, (
            username, full_name, phone_number, email, address, password,
            profile_picture, bio, social_links, instruments, rating,
            user_type, genres, videos
        ))

        user_id = cursor.fetchone()[0]  # Get the new user's id

        conn.commit()

        cursor.close()
        conn.close()

        return {
            'statusCode': 200,
            'body': json.dumps('User and videos inserted successfully!')
        }

    except Exception as e:
        if conn:
            conn.rollback()  # Rollback if any error occurs
        return {
            'statusCode': 500,
            'body': f"Database error: {e}"
        }


# Local testing
if __name__ == "__main__":
    import json

    test_event = {
        "body": json.dumps({
            "username": "Mergui",
            "phone_number": "+972543170570",
            "email": "Mergui@example.com",
            "address": "Tel aviv,",
            "password": "safe_password",
            "profile_picture": "https://s3.amazonaws.com/yourbucket/images/profile-pic.jpg",
            "bio": "I love to play the guitar",
            "social_links": "https://www.instagram.com/lahav",
            "instruments": {
                 "Cello": "Beginner",
                 "Keyboard": "Intermediate"
            },  # SERIALIZE instruments to JSON string
            "rating": 4.9,
            "user_type": "musician",
            "genres": ["Rock", "Jazz", "Hip Hop"],  # 👈 KEEP genres as normal list (text[])
            "full_name": "Lahav Rabinovitz"
        })
    }

    response = lambda_handler(test_event, None)
    print(response)
