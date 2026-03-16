# What is Addendum?

In the context of an EMR (Electronic Medical Record) system, an **addendum** is an additional note or update that is appended to a finalized clinical document or encounter note after it has been completed. Addendums are used to correct, clarify, or supplement the original documentation without altering the original content, ensuring a clear audit trail and legal compliance.

## In This Codebase

- **Type Definition:**  
  The `Addendum` type is defined in `features/basic-emr/types.ts`:

  ```ts
  export interface Addendum {
    id: string;
    encounterId: string;
    content: string;
    timestamp: string;
    author: string;
  }
  ```

  - `id`: Unique identifier for the addendum.
  - `encounterId`: The ID of the encounter this addendum is attached to.
  - `content`: The text/content of the addendum.
  - `timestamp`: When the addendum was created.
  - `author`: Who authored the addendum.

- **Database Table:**  
  The `addendums` table in the database stores these records, each linked to an `encounter`.

- **API Usage:**  
  The API allows you to create an addendum for an encounter via:

  ```
  POST /api/basic-emr/addendums
  {
    "encounterId": "string",
    "content": "string",
    "author": "string"
  }
  ```

- **Purpose:**  
  - To **append new information** to a clinical note after it has been signed/finalized.
  - To **maintain the integrity** of the original record (the original note is not changed).
  - To **comply with legal and medical record-keeping standards**.

**Example:**  
If a provider realizes after finalizing a note that they forgot to mention a patient’s allergy, they can add an addendum stating:  
> "Addendum: Patient reports allergy to penicillin, not previously documented."

This addendum is timestamped and attributed to the author, and is always associated with the original encounter.

If you need to see how addendums are created or displayed in the UI, or want to know more about their workflow, let me know!
