from pydantic import BaseModel
from .db_models import DeliveryPost

class DeliveryPostBase(BaseModel):
    office_name: str
    pincode: int | None = None
    office_type: str | None = None
    district: str | None = None
    state_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None

class DeliveryPost(DeliveryPostBase):
    id: int

    class Config:
        from_attributes = True # Changed from orm_mode = True in Pydantic v2

class HybridSearchResult(DeliveryPost):
    distance_km: float

    class Config:
        from_attributes = True