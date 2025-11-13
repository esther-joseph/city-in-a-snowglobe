import React, { useState } from 'react'
import './ExpandableUIPanel.css'

function ExpandableUIPanel({ children, isExpanded: controlledExpanded, onToggle }) {
  const [internalExpanded, setInternalExpanded] = useState(true)
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded
  const handleToggle = () => {
    if (onToggle) {
      onToggle(!isExpanded)
    } else {
      setInternalExpanded(!internalExpanded)
    }
  }

  return (
    <div className={`expandable-ui-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button 
        className="panel-toggle-button"
        onClick={handleToggle}
        aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
      >
        <span className="toggle-icon">{isExpanded ? '◀' : '▶'}</span>
      </button>
      <div className="panel-content">
        {children}
      </div>
    </div>
  )
}

export default ExpandableUIPanel

