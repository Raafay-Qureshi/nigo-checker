"""Pydantic model of an extracted new-account packet.

Every scalar field is a ValuedField {value, confidence}: the LLM reports its own 0..1
confidence per field, and value is null (confidence 0) when the field isn't on the page.
This mirrors the JS packet shape after normalization (see main.normalize)."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class ValuedField(BaseModel):
    value: Optional[str] = None
    confidence: float = 0.0


class Beneficiary(BaseModel):
    name: Optional[str] = None
    relationship: Optional[str] = None
    type: Optional[str] = None          # "primary" | "contingent"
    percent: float = 0.0


class Account(BaseModel):
    type: ValuedField = Field(default_factory=ValuedField)
    registration_name: ValuedField = Field(default_factory=ValuedField)


class Owner(BaseModel):
    full_name: ValuedField = Field(default_factory=ValuedField)
    dob: ValuedField = Field(default_factory=ValuedField)
    ssn: ValuedField = Field(default_factory=ValuedField)
    address: ValuedField = Field(default_factory=ValuedField)
    phone: ValuedField = Field(default_factory=ValuedField)
    email: ValuedField = Field(default_factory=ValuedField)
    employer: ValuedField = Field(default_factory=ValuedField)
    affiliated_with_broker_dealer: ValuedField = Field(default_factory=ValuedField)


class IdDocument(BaseModel):
    name: ValuedField = Field(default_factory=ValuedField)
    address: ValuedField = Field(default_factory=ValuedField)
    dob: ValuedField = Field(default_factory=ValuedField)
    expiry: ValuedField = Field(default_factory=ValuedField)


class TrustedContact(BaseModel):
    name: ValuedField = Field(default_factory=ValuedField)
    phone: ValuedField = Field(default_factory=ValuedField)


class Transfer(BaseModel):
    holder_name: ValuedField = Field(default_factory=ValuedField)
    source_account_type: ValuedField = Field(default_factory=ValuedField)
    account_number: ValuedField = Field(default_factory=ValuedField)


class Signature(BaseModel):
    present: bool = False
    date: ValuedField = Field(default_factory=ValuedField)


class Packet(BaseModel):
    account: Account = Field(default_factory=Account)
    owner: Owner = Field(default_factory=Owner)
    id_document: IdDocument = Field(default_factory=IdDocument)
    beneficiaries: List[Beneficiary] = Field(default_factory=list)
    trusted_contact: Optional[TrustedContact] = None
    transfer: Optional[Transfer] = None
    signature: Signature = Field(default_factory=Signature)


# A compact JSON example shown to the model so json_object mode returns the right shape.
EXAMPLE_JSON = """{
  "account": {"type": {"value": "individual", "confidence": 0.98},
              "registration_name": {"value": "Jane A Carter", "confidence": 0.97}},
  "owner": {"full_name": {"value": "Jane A Carter", "confidence": 0.98},
            "dob": {"value": "1985-03-12", "confidence": 0.95},
            "ssn": {"value": "501-23-4567", "confidence": 0.9},
            "address": {"value": "88 Birch Lane, Springfield, IL 62704", "confidence": 0.9},
            "phone": {"value": "217-555-0142", "confidence": 0.9},
            "email": {"value": "jane.carter@example.com", "confidence": 0.95},
            "employer": {"value": "Oakline Design Co", "confidence": 0.9},
            "affiliated_with_broker_dealer": {"value": "no", "confidence": 0.9}},
  "id_document": {"name": {"value": "Jane A Carter", "confidence": 0.97},
                  "address": {"value": "88 Birch Lane, Springfield, IL 62704", "confidence": 0.9},
                  "dob": {"value": "1985-03-12", "confidence": 0.95},
                  "expiry": {"value": "2029-03-12", "confidence": 0.95}},
  "beneficiaries": [{"name": "Mark Carter", "relationship": "spouse", "type": "primary", "percent": 100}],
  "trusted_contact": {"name": {"value": "Ellen Park", "confidence": 0.9},
                      "phone": {"value": "217-555-0199", "confidence": 0.9}},
  "transfer": null,
  "signature": {"present": true, "date": {"value": "2026-11-10", "confidence": 0.95}}
}"""
