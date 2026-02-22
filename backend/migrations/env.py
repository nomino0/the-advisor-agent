"""Alembic env.py that loads DB URL from application settings.

This env uses the synchronous URL from `app.config.settings.sync_database_url`.
Run Alembic from the `backend/` folder: `alembic upgrade head`.
"""
from __future__ import with_statement
import os
import sys
from logging.config import fileConfig

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from alembic import context
from sqlalchemy import engine_from_config, pool

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    try:
        fileConfig(config.config_file_name)
    except Exception as e:
        # Don't fail migrations just because the logging config in alembic.ini
        # is missing sections or is otherwise invalid in this environment.
        import logging
        logging.basicConfig(level=logging.INFO)
        logging.getLogger(__name__).warning(
            "Could not load logging config '%s': %s",
            config.config_file_name,
            e,
        )

# Import application settings to read DATABASE_URL (sync)
try:
    from app.config import settings
    db_url = settings.sync_database_url
except Exception:
    db_url = None

if not db_url:
    # Fall back to the sqlalchemy.url in alembic.ini if present
    db_url = config.get_main_option('sqlalchemy.url')

if not db_url:
    raise RuntimeError('Database URL not configured for Alembic. Set DATABASE_URL in environment or settings.sync_database_url.')

# set the sqlalchemy.url programmatically
config.set_main_option('sqlalchemy.url', db_url)

# add your model's MetaData object here for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = None


def run_migrations_offline():
    url = config.get_main_option('sqlalchemy.url')
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
