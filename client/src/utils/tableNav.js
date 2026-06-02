export const handleTableEnterNav = (e) => {
  const input = e.target;
  if (input.tagName !== 'INPUT') return;

  const isFullySelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;

  if (e.key === 'ArrowRight') {
    if (!isFullySelected && input.selectionStart !== input.value.length) return;
    const td = input.closest('td');
    if (!td) return;
    const tr = td.closest('tr');
    if (!tr) return;

    const cells = Array.from(tr.children);
    const colIndex = cells.indexOf(td);

    for (let i = colIndex + 1; i < cells.length; i++) {
      const nextInput = cells[i].querySelector('input');
      if (nextInput) {
        e.preventDefault();
        nextInput.focus();
        nextInput.select();
        return;
      }
    }
  } else if (e.key === 'ArrowLeft') {
    if (!isFullySelected && input.selectionEnd !== 0) return;
    const td = input.closest('td');
    if (!td) return;
    const tr = td.closest('tr');
    if (!tr) return;

    const cells = Array.from(tr.children);
    const colIndex = cells.indexOf(td);

    for (let i = colIndex - 1; i >= 0; i--) {
      const prevInput = cells[i].querySelector('input');
      if (prevInput) {
        e.preventDefault();
        prevInput.focus();
        prevInput.select();
        return;
      }
    }
  } else if (e.key === 'Enter' || e.key === 'ArrowDown') {
    const td = input.closest('td');
    if (!td) return;
    const tr = td.closest('tr');
    if (!tr) return;
    const tbody = tr.closest('tbody');
    if (!tbody) return;

    const cells = Array.from(tr.children);
    const colIndex = cells.indexOf(td);

    if (colIndex === -1) return;

    const rows = Array.from(tbody.children);
    const rowIndex = rows.indexOf(tr);
    
    for (let i = rowIndex + 1; i < rows.length; i++) {
      const nextRow = rows[i];
      const nextTd = nextRow.children[colIndex];
      if (nextTd) {
        const nextInput = nextTd.querySelector('input');
        if (nextInput) {
          e.preventDefault();
          nextInput.focus();
          nextInput.select();
          return;
        }
      }
    }
  } else if (e.key === 'ArrowUp') {
    const td = input.closest('td');
    if (!td) return;
    const tr = td.closest('tr');
    if (!tr) return;
    const tbody = tr.closest('tbody');
    if (!tbody) return;

    const cells = Array.from(tr.children);
    const colIndex = cells.indexOf(td);

    if (colIndex === -1) return;

    const rows = Array.from(tbody.children);
    const rowIndex = rows.indexOf(tr);
    
    for (let i = rowIndex - 1; i >= 0; i--) {
      const prevRow = rows[i];
      const prevTd = prevRow.children[colIndex];
      if (prevTd) {
        const prevInput = prevTd.querySelector('input');
        if (prevInput) {
          e.preventDefault();
          prevInput.focus();
          prevInput.select();
          return;
        }
      }
    }
  }
};
