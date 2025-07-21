import styled from 'styled-components'

// Common styled components that match PolaroidPhoto
export const CommonThumbtrack = styled.div`
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: 
    radial-gradient(circle at 30% 30%, #ff6b6b, #e74c3c);
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 1px 2px rgba(255, 255, 255, 0.4);
  z-index: 100;
  
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 3px;
    height: 3px;
    background: #8b0000;
    border-radius: 50%;
  }
`

export const CommonActionButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  z-index: 200;

  &:hover {
    background: #e5e7eb;
    transform: scale(1.1);
  }
`

export const CommonDrawButton = styled.button<{ $active: boolean }>`
  position: absolute;
  top: 8px;
  right: 40px;
  background: ${props => props.$active ? '#3b82f6' : 'rgba(255, 255, 255, 0.9)'};
  color: ${props => props.$active ? 'white' : '#374151'};
  border: none;
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  z-index: 110;

  &:hover {
    background: ${props => props.$active ? '#2563eb' : 'rgba(255, 255, 255, 1)'};
    transform: scale(1.1);
  }
`
