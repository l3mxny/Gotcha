"""S3 upload/delete helpers for evidence frame storage."""

from __future__ import annotations

import logging

import boto3

logger = logging.getLogger(__name__)


def _client(*, aws_access_key_id: str, aws_secret_access_key: str, aws_region: str):
    return boto3.client(
        "s3",
        region_name=aws_region,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
    )


def upload_evidence_frame(
    *,
    key: str,
    data: bytes,
    aws_access_key_id: str,
    aws_secret_access_key: str,
    aws_region: str,
    aws_bucket_name: str,
    content_type: str = "image/jpeg",
) -> str:
    """Upload one frame to S3 and return its public object URL."""
    client = _client(
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        aws_region=aws_region,
    )
    client.put_object(Bucket=aws_bucket_name, Key=key, Body=data, ContentType=content_type)
    return f"https://{aws_bucket_name}.s3.{aws_region}.amazonaws.com/{key}"


def delete_evidence_prefix(
    *,
    prefix: str,
    aws_access_key_id: str,
    aws_secret_access_key: str,
    aws_region: str,
    aws_bucket_name: str,
) -> None:
    """Delete all objects under an S3 key prefix (an incident's evidence folder)."""
    client = _client(
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        aws_region=aws_region,
    )
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=aws_bucket_name, Prefix=prefix):
        objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
        if objects:
            client.delete_objects(Bucket=aws_bucket_name, Delete={"Objects": objects})
