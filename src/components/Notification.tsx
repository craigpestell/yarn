import React from 'react'
import styled from 'styled-components'
import { CheckCircle, XCircle, Info } from 'lucide-react'

const NotificationContainer = styled.div<{ $visible: boolean }>`
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 16px 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10001;
  transform: translateX(${props => props.$visible ? '0' : '100%'});
  opacity: ${props => props.$visible ? '1' : '0'};
  transition: all 0.3s ease;
  font-family: 'Courier New', monospace;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
`

const NotificationText = styled.div`
  font-size: 0.9rem;
`

export type NotificationType = 'success' | 'error' | 'info'

interface NotificationProps {
  message: string
  type: NotificationType
  visible: boolean
  onClose: () => void
}

const Notification: React.FC<NotificationProps> = ({ message, type, visible }) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} color="#22c55e" />
      case 'error':
        return <XCircle size={20} color="#ef4444" />
      case 'info':
      default:
        return <Info size={20} color="#3b82f6" />
    }
  }

  return (
    <NotificationContainer $visible={visible}>
      {getIcon()}
      <NotificationText>{message}</NotificationText>
    </NotificationContainer>
  )
}

export default Notification
