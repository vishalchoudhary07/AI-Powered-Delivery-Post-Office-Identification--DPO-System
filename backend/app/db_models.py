from sqlalchemy import Column, Integer, String, Double
from geoalchemy2 import Geometry
from geoalchemy2 import Geography
from .database import Base

class DeliveryPost(Base):
    __tablename__ = "delivery_posts"

    id = Column(Integer, primary_key=True, index=True)
    office_name = Column(String)
    pincode = Column(Integer)
    office_type = Column(String)
    delivery_status = Column(String)
    division_name = Column(String)
    region_name = Column(String)
    circle_name = Column(String)
    district = Column(String)
    state_name = Column(String)
    latitude = Column(Double)
    longitude = Column(Double)
    # This tells SQLAlchemy how to handle the PostGIS location column
    location = Column(Geography(geometry_type='POINT', srid=4326))