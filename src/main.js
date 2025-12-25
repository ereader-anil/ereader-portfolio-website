import { initUi } from './ui.js'

// Check if user is logged in via API
async function checkAuth() {
  try {
    const response = await fetch('/api/session')
    const data = await response.json()
    return data.isLoggedIn
  } catch (error) {
    console.error('Auth check failed:', error)
    return false
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  const isLoggedIn = await checkAuth()

  if (isLoggedIn) {
    initUi()
  } else {
    // Redirect to login page
    window.location.href = '/login'
  }
})
