from sqlalchemy.orm import Session
from sqlalchemy import func
from . import db_models
from geoalchemy2.functions import ST_DWithin

# New imports for the fast geospatial function
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

def get_posts(db: Session, skip: int = 0, limit: int = 100):
    """
    Retrieves a list of delivery posts from the database with pagination.
    """
    return db.query(db_models.DeliveryPost).offset(skip).limit(limit).all()

def get_nearest_posts(db: Session, lat: float, lon: float, max_distance_km: int = 5, limit: int = 10):
    """
    Finds the nearest delivery posts using an efficient PostGIS geospatial query.
    """
    user_point = Point(lon, lat)
    # Note: PostGIS works with (longitude, latitude)
    
    # SRID 4326 is the standard for GPS coordinates
    wkt_point = from_shape(user_point, srid=4326)

    # ST_DWithin is a PostGIS function that uses a spatial index to find things within a distance
    # The distance is in meters, so we convert km to m
    distance_in_meters = max_distance_km * 1000
    
    query = db.query(db_models.DeliveryPost).filter(
        func.ST_DWithin(
            db_models.DeliveryPost.location,
            wkt_point,
            distance_in_meters
        )
    ).limit(limit)
    
    return query.all()
def get_posts_by_ids(db: Session, ids: list[int]):
    """
    Fetches multiple delivery posts from the database based on a list of IDs.
    """
    if not ids:
        return []
    return db.query(db_models.DeliveryPost).filter(db_models.DeliveryPost.id.in_(ids)).all()
def get_post_ids_within_radius(db: Session, lat: float, lon: float, radius_km: float) -> list[int]:
    """
    Efficiently finds the IDs of all posts within a given radius from a central point
    using a PostGIS geospatial query.

    Args:
        db (Session): The database session.
        lat (float): The latitude of the center point.
        lon (float): The longitude of the center point.
        radius_km (float): The search radius in kilometers.

    Returns:
        list[int]: A list of DeliveryPost IDs within the radius.
    """
    # Convert the search radius from kilometers to meters, as PostGIS works with meters.
    radius_meters = radius_km * 1000

    # Create a geographic point from the user's lat/lon.
    # The '4326' is the SRID for the standard WGS 84 coordinate system.
    user_location_geography = f'SRID=4326;POINT({lon} {lat})'

    # This is the core of the efficient query.
    # It asks the database: "Find all DeliveryPost records where the 'location'
    # is within X meters of the user's location".
    # This query uses the spatial index and is extremely fast.
    post_ids = db.query(db_models.DeliveryPost.id).filter(
        ST_DWithin(
            db_models.DeliveryPost.location,
            user_location_geography,
            radius_meters
        )
    ).all()

    # The query returns a list of tuples, so we flatten it into a simple list of integers.
    return [pid[0] for pid in post_ids]