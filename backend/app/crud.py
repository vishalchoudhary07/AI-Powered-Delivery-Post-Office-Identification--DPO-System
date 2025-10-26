from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from . import db_models
from geoalchemy2.functions import ST_DWithin
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from typing import List


async def get_posts(db: AsyncSession, skip: int = 0, limit: int = 100):
    """
    Retrieves a list of delivery posts from the database with pagination.
    """
    result = await db.execute(
        select(db_models.DeliveryPost).offset(skip).limit(limit)
    )
    return result.scalars().all()


async def get_nearest_posts(db: AsyncSession, lat: float, lon: float, max_distance_km: int = 5, limit: int = 10):
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
    
    result = await db.execute(
        select(db_models.DeliveryPost)
        .where(
            func.ST_DWithin(
                db_models.DeliveryPost.location,
                wkt_point,
                distance_in_meters
            )
        )
        .limit(limit)
    )
    
    return result.scalars().all()


async def get_posts_by_ids(db: AsyncSession, ids: List[int]):
    """
    Fetches multiple delivery posts from the database based on a list of IDs.
    """
    if not ids:
        return []
    
    result = await db.execute(
        select(db_models.DeliveryPost).where(db_models.DeliveryPost.id.in_(ids))
    )
    return result.scalars().all()


async def get_post_ids_within_radius(db: AsyncSession, lat: float, lon: float, radius_km: float) -> List[int]:
    """
    Efficiently finds the IDs of all posts within a given radius from a central point
    using a PostGIS geospatial query.

    Args:
        db (AsyncSession): The database session.
        lat (float): The latitude of the center point.
        lon (float): The longitude of the center point.
        radius_km (float): The search radius in kilometers.

    Returns:
        List[int]: A list of DeliveryPost IDs within the radius.
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
    result = await db.execute(
        select(db_models.DeliveryPost.id)
        .where(
            ST_DWithin(
                db_models.DeliveryPost.location,
                user_location_geography,
                radius_meters
            )
        )
    )
    
    post_ids = result.scalars().all()
    
    # Return the list of IDs
    return list(post_ids)
