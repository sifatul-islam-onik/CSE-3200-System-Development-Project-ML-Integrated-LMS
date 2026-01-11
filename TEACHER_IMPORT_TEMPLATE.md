# Teacher Import Template

This document describes the Excel format required for bulk importing teachers into the LMS.

## Overview

Teachers can no longer self-register. Instead, administrators must create teacher accounts using the **Teacher Import** feature in the Admin Dashboard by uploading an Excel file.

## File Format

### Required Columns

The Excel file must contain the following columns (case-insensitive):

| Column Name | Type | Description | Example |
|-------------|------|-------------|---------|
| **Full Name** | Text | Teacher's complete name | Dr. Ahmed Hassan Khan |
| **Name** | Text | Short name used for email (first word will be used) | Ahmed |
| **Dept** | Text | Department code/abbreviation | CSE |
| **Designation** | Text | Teacher's designation. If empty, defaults to Lecturer | Assistant Professor |

### Column Name Variations

The system accepts variations of column names:
- **Full Name**: "Full Name", "full name", "FullName", "fullName"
- **Name**: "Name", "name" 
- **Dept**: "Dept", "dept", "Department", "department"
- **Designation**: "Designation", "designation", and minor variants (spaces/underscores are ignored)

### Example Data

```
Full Name                  | Name      | Dept | Designation
---------------------------|-----------|------|--------------------
Dr. Ahmed Hassan Khan      | Ahmed     | CSE  | Assistant Professor
Prof. Fatima Amin          | Fatima    | EEE  | Professor
Mr. Bilal Ahmed Malik      | Bilal     | ME   | Lecturer
Dr. Sara Khan              | Sara      | BTE  | Lecturer
```

## Auto-Generated Information

When teachers are imported, the system automatically generates:

1. **Email**: `{firstname}@{department}.kuet.ac.bd`
   - firstname: First word of "Name" field, lowercased
   - department: Department code, lowercased
   - Example: Ahmed from CSE department → `ahmed@cse.kuet.ac.bd`

2. **Password**: 8-character random password
   - Contains uppercase, lowercase, and numbers
   - Example: `K7mNpQr2`
   - Must be securely communicated to the teacher

3. **Status**: ACTIVE
   - Teacher accounts are immediately active after import
   - Email is auto-verified

## Import Process

### Step 1: Prepare Excel File
1. Create Excel file (.xlsx, .xls, or .csv)
2. Add header row with column names
3. Add teacher data rows (one teacher per row)
4. Save file

### Step 2: Upload in Admin Dashboard
1. Go to Admin Dashboard
2. Click "Teacher Import" in sidebar
3. Click file input and select your Excel file
4. Click "Import Teachers" button
5. System will process and display results

### Step 3: Distribution
1. Results will show all created teacher accounts with credentials
2. Save/print credentials securely
3. Distribute to respective teachers via secure channel
4. Instruct teachers to login and change password on first login

## Validation Rules

- **Full Name**: Required, must not be empty
- **Name**: Required, must not be empty (used for email)
- **Dept**: Required, must not be empty
- **Email Uniqueness**: If email already exists, row will be skipped
- **Row Numbering**: Data starts from Row 2 (Row 1 is header)

## Error Handling

The system returns detailed information about:
- ✅ **Created**: Number of successfully imported teachers
- ⏭️ **Skipped**: Rows skipped (e.g., duplicate emails)
- ❌ **Errors**: Validation or processing errors with row numbers

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Full Name is required" | Missing/empty Full Name column | Add Full Name for all rows |
| "Name is required" | Missing/empty Name column | Add Name for all rows |
| "Dept is required" | Missing/empty Dept column | Add Dept for all rows |
| "Email already exists" | Teacher email already in system | Check for duplicates or existing teacher |

## Security Considerations

1. **Password Security**
   - Passwords are generated securely and shown only once
   - Save them in a secure location
   - Print credentials only for authorized personnel

2. **Email Verification**
   - Imported teachers don't need to verify email
   - They can login immediately after import

3. **Access Control**
   - Only admins can import teachers
   - Import history is logged in system

## Excel Template Download

Sample files are provided in the project root:

- **[TEACHER_IMPORT_SAMPLE.xlsx](TEACHER_IMPORT_SAMPLE.xlsx)** - Excel format (recommended)
- **[TEACHER_IMPORT_SAMPLE.csv](TEACHER_IMPORT_SAMPLE.csv)** - CSV format (can be opened in Excel)

### Sample Data Included:

| Full Name | Name | Dept | Designation |
|-----------|------|------|-------------|
| Dr. Ahmed Hassan Khan | Ahmed | CSE | Assistant Professor |
| Prof. Fatima Amin | Fatima | EEE | Professor |
| Mr. Bilal Ahmed Malik | Bilal | ME | Lecturer |
| Dr. Sara Khan | Sara | BTE | Lecturer |
| Prof. Muhammad Hasan | Hasan | IPE | Professor |
| Dr. Aisha Ahmed | Aisha | CE | Lecturer |

You can use these files as templates for your own teacher imports or test the import functionality.

## FAQ

**Q: Can teachers still self-register?**
A: No, teacher self-registration has been removed. All teacher accounts are created by admins via Excel import.

**Q: What if a teacher email already exists?**
A: The row will be skipped as a duplicate. Check if the teacher already has an account or modify the name/department.

**Q: Can I import multiple files?**
A: Yes, you can run multiple imports. Each import will create new teachers not already in the system.

**Q: How do I update teacher information?**
A: Modify teacher information directly in the "All Users" section or via admin tools.

**Q: What if I lose the password?**
A: Teachers should use "Forgot Password" on login page. If that fails, admin can delete and re-import the teacher account.

## Support

For issues or questions about teacher import:
1. Check error messages returned by the system
2. Verify Excel file format matches template
3. Contact system administrator
