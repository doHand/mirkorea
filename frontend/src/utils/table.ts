export function editableRowProps(editable: boolean, onEdit: () => void) {
  return editable ? { onDoubleClick: onEdit, className: 'cursor-pointer' } : {}
}
