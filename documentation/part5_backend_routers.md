# Part 5: Backend Routers Technical Audit & Specs

This document catalog-audits the API endpoint sub-routers located in the [backend/routers/](file:///d:/Coding/KOBIE_hackathon/backend/routers/) directory. It details the endpoints, query engines, Pydantic exchange schemas, and transition flows.

---

## 📈 1. Program Evolution Router (`backend/routers/evolution.py`)

* **File Reference**: [evolution.py](file:///d:/Coding/KOBIE_hackathon/backend/routers/evolution.py)
* **Role**: Analyzes historical changes for a program by comparing the oldest database extraction run against the newest run, utilizing LLM-based strategic impact generation.
* **APIRouter prefix**: `/api/programs`
* **Tags**: `["evolution"]`

### 📋 API Interaction Schemas (Pydantic Models)

#### `ChangelogItem`
Used to represent a single field difference between runs:
* `category` (str): Category grouping of the field (e.g., `'earn_mechanics'`).
* `field_name` (str): Database identifier for the parameter.
* `old_value` (Optional[str]): Value extracted during the first run.
* `new_value` (Optional[str]): Value extracted during the latest run.
* `change_type` (str): Classification of change, strictly bounded to:
  * `'upgraded'`: Parameter represents an improvement.
  * `'devalued'`: Parameter represents a reduction in benefit.
  * `'altered'`: Parameter text has changed without direct positive/negative bias.
  * `'none'`: No functional change.
* `analysis` (str): Strategic consulting-grade audit describing what changed and its market impact.

#### `EvolutionOutput`
Encompasses the global response payload of the router:
* `executive_summary` (str): High-level overview summarizing program changes.
* `changelog` (list[ChangelogItem]): Set of specific parameter differences.

---

## ⚙️ 2. Endpoint Implementation Deep-Dive

### 🟢 `GET /{program_id}/evolution`
* **Function**: `get_program_evolution(program_id: uuid.UUID, db: AsyncSession = Depends(get_db))`
* **Database Query Flow**:
  1. Fetches the `Program` row from PostgreSQL. If missing, throws a `404 HTTPException`.
  2. Queries all `ExtractedField` records where:
     * `program_id` matches the path param.
     * `gate_passed == True` (ignoring unverified/hallucinated fields).
     * Ordered chronologically: `order_by(ExtractedField.created_at.asc())`.
  3. If no fields are returned, throws a `404 HTTPException` (*"No extraction data found for this program."*).

### 🔍 Diff-Detection Algorithm
The endpoint parses the chronology lists to detect changes:
1. Groups fields into lists by name: `by_field.setdefault(f.field_name, []).append(f)`.
2. For each group, selects the first entry as `oldest = run_list[0]` and the last entry as `newest = run_list[-1]`.
3. Checks if `oldest.id != newest.id`. If true, appends details (category, field name, values, and timestamps) to a `diff_lines` buffer:
   ```
   - Category: {oldest.category}
     Field: {field_name}
     Old Value (extracted {oldest.created_at.isoformat()}): {old_val}
     New Value (extracted {newest.created_at.isoformat()}): {new_val}
   ```
4. **Early Exit**: If `diff_lines` is empty, returns:
   ```json
   {
     "executive_summary": "No changes detected. The program has only been run once, or no fields have evolved.",
     "changelog": []
   }
   ```

### 🧠 LLM Analysis & Non-Blocking Design
1. Compiles the `diff_lines` buffer into a user prompt.
2. Injects the `EvolutionOutput` schema as `response_model` into the Instructor completion parameters.
3. **Thread Safety Guard**: Because the Instructor completion client uses a blocking SDK structure under the hood, the router avoids blocking the main event loop by running it in a thread pool executor:
   ```python
   loop = asyncio.get_running_loop()
   def _call_llm():
       return client.chat.completions.create(**kwargs)
   res = await loop.run_in_executor(None, _call_llm)
   ```
4. Dumps the schema using `.model_dump()` to return a validated JSON payload to the FastAPI router.
