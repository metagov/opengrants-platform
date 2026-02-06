#!/usr/bin/env python3
"""
Utility script to fetch GraphQL schemas via introspection.

Usage:
    python fetch_schema.py <source_name> <graphql_endpoint>

Examples:
    python fetch_schema.py giveth https://mainnet.serve.giveth.io/graphql
    python fetch_schema.py privote $MACI_GRAPHQL_ENDPOINT
"""

import json
import sys
from pathlib import Path
import urllib.request
import urllib.error

INTROSPECTION_QUERY = """
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types { ...FullType }
    directives {
      name
      description
      locations
      args { ...InputValue }
    }
  }
}

fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args { ...InputValue }
    type { ...TypeRef }
    isDeprecated
    deprecationReason
  }
  inputFields { ...InputValue }
  interfaces { ...TypeRef }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
  possibleTypes { ...TypeRef }
}

fragment InputValue on __InputValue {
  name
  description
  type { ...TypeRef }
  defaultValue
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
  }
}
"""


def fetch_schema(endpoint: str) -> dict:
    """Fetch GraphQL schema via introspection query."""
    data = json.dumps({"query": INTROSPECTION_QUERY}).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def schema_to_sdl(schema_data: dict) -> str:
    """Convert introspection result to SDL-like summary (simplified)."""
    lines = ["# GraphQL Schema Summary", "# Generated from introspection", ""]

    schema = schema_data.get("data", {}).get("__schema", {})
    types = schema.get("types", [])

    # Filter out built-in types
    user_types = [t for t in types if not t["name"].startswith("__")]

    for t in sorted(user_types, key=lambda x: (x["kind"], x["name"])):
        kind = t["kind"]
        name = t["name"]

        if kind == "OBJECT":
            lines.append(f"type {name} {{")
            for field in t.get("fields", []) or []:
                field_type = format_type(field["type"])
                lines.append(f"  {field['name']}: {field_type}")
            lines.append("}")
            lines.append("")
        elif kind == "INPUT_OBJECT":
            lines.append(f"input {name} {{")
            for field in t.get("inputFields", []) or []:
                field_type = format_type(field["type"])
                lines.append(f"  {field['name']}: {field_type}")
            lines.append("}")
            lines.append("")
        elif kind == "ENUM":
            lines.append(f"enum {name} {{")
            for val in t.get("enumValues", []) or []:
                lines.append(f"  {val['name']}")
            lines.append("}")
            lines.append("")
        elif kind == "INTERFACE":
            lines.append(f"interface {name} {{")
            for field in t.get("fields", []) or []:
                field_type = format_type(field["type"])
                lines.append(f"  {field['name']}: {field_type}")
            lines.append("}")
            lines.append("")

    return "\n".join(lines)


def format_type(type_ref: dict) -> str:
    """Format a type reference to SDL notation."""
    if type_ref is None:
        return "Unknown"

    kind = type_ref.get("kind")
    name = type_ref.get("name")
    of_type = type_ref.get("ofType")

    if kind == "NON_NULL":
        return f"{format_type(of_type)}!"
    elif kind == "LIST":
        return f"[{format_type(of_type)}]"
    else:
        return name or "Unknown"


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    source_name = sys.argv[1]
    endpoint = sys.argv[2]

    script_dir = Path(__file__).parent
    output_dir = script_dir / source_name
    output_dir.mkdir(exist_ok=True)

    print(f"Fetching schema from {endpoint}...")

    try:
        result = fetch_schema(endpoint)

        # Save raw introspection JSON
        json_path = output_dir / "introspection.json"
        with open(json_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Saved introspection JSON to {json_path}")

        # Generate SDL summary
        sdl = schema_to_sdl(result)
        sdl_path = output_dir / "schema.graphql"
        with open(sdl_path, "w") as f:
            f.write(sdl)
        print(f"Saved SDL summary to {sdl_path}")

        # Print summary
        schema = result.get("data", {}).get("__schema", {})
        types = [t for t in schema.get("types", []) if not t["name"].startswith("__")]
        print(f"\nSchema summary:")
        print(f"  - {len(types)} types")
        print(f"  - Query type: {(schema.get('queryType') or {}).get('name')}")
        print(f"  - Mutation type: {(schema.get('mutationType') or {}).get('name')}")

    except urllib.error.URLError as e:
        print(f"Error fetching schema: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing response: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
