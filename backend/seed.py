"""The shared mini_erp database is owned by the ERP database teammate.

This project intentionally does not create or seed inventory tables. Add seed
rows through the team's approved SQL/Django seed process instead.
"""

if __name__ == "__main__":
    print("No local seed was run. This service uses the existing shared mini_erp schema.")
    print("Create catalog products and inventory stock-level rows through the approved team process.")
