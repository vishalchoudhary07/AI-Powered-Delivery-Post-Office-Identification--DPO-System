import os
import pandas as pd
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import sys

def load_data():
    """
    Connects to the PostgreSQL database, reads and CLEANS DPO data from a CSV,
    and bulk-inserts it into the delivery_posts table.
    """
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(dotenv_path=dotenv_path)

    csv_path = os.path.join(os.path.dirname(__file__), 'dpo_data.csv')
    conn = None
    try:
        print("Connecting to the database...")
        conn = psycopg2.connect(
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT")
        )
        cur = conn.cursor()
        print("Database connection successful.")

        print(f"Reading data from {csv_path}...")
        df = pd.read_csv(csv_path)
        print(f"Found {len(df)} records in the CSV file.")

        # ##################################################################
        # ### --- NEW DATA CLEANING STEP --- ###
        # ##################################################################
        print("Cleaning Latitude and Longitude data...")
        
        # Use regex to remove any character that is NOT a digit, a dot, or a minus sign.
        # This handles values like "84.0464 E", "21.916 N", etc.
        df['longitude_clean'] = pd.to_numeric(df['Longitude'].astype(str).str.replace(r'[^\d.-]', '', regex=True), errors='coerce')
        df['latitude_clean'] = pd.to_numeric(df['Latitude'].astype(str).str.replace(r'[^\d.-]', '', regex=True), errors='coerce')

        # Drop any rows where the conversion failed (e.g., the cell was empty or had junk data)
        original_count = len(df)
        df.dropna(subset=['longitude_clean', 'latitude_clean'], inplace=True)
        cleaned_count = len(df)
        
        if original_count > cleaned_count:
            print(f"Warning: Dropped {original_count - cleaned_count} rows due to invalid coordinate data.")
        
        print(f"Successfully cleaned and validated {cleaned_count} records for insertion.")
        # ##################################################################

        # Prepare the data for insertion using the NEW cleaned columns
        data_with_geom = [
            (
                row['OfficeName'], row['Pincode'], row['OfficeType'], 
                row['Delivery'], row['DivisionName'], row['RegionName'],
                row['CircleName'], row['District'], row['StateName'],
                # Original lat/lon columns are now the cleaned ones
                row['latitude_clean'], row['longitude_clean'],
                # Add lon and lat again for the ST_MakePoint function
                row['longitude_clean'], row['latitude_clean']
            ) for index, row in df.iterrows()
        ]

        insert_query = """
            INSERT INTO delivery_posts (
                office_name, pincode, office_type, delivery_status,
                division_name, region_name, circle_name, district, state_name,
                latitude, longitude, location
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)
            )
        """

        print("Starting bulk insert... This may take a minute or two.")
        psycopg2.extras.execute_batch(cur, insert_query, data_with_geom)
        
        conn.commit()
        print("Data loaded successfully!")

    except FileNotFoundError:
        print(f"Error: The file {csv_path} was not found.")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            cur.close()
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    load_data()