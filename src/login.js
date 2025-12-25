// login.js - Handles login page functionality
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm')
  const loginBtn = document.querySelector('.login-btn')
  const btnText = document.querySelector('.btn-text')
  const loginContainer = document.querySelector('.login-container')
  const forgotPasswordLink = document.querySelector('.forgot-password')

  // Check if already logged in
  checkSession()

  async function checkSession() {
    try {
      const response = await fetch('/api/session')
      const data = await response.json()

      if (data.isLoggedIn) {
        showAlreadyLoggedIn(data.username)
        return
      }
    } catch (error) {
      console.error('Session check failed:', error)
    }

    // If not logged in, show the login form
    loginForm.style.display = 'block'
  }

  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    const formData = new FormData(loginForm)
    const username = formData.get('username').trim()
    const password = formData.get('password').trim()
    const rememberMe = formData.get('rememberMe') === 'on'

    // Show loading state
    showLoading(true)

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, rememberMe })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        handleLoginSuccess(username)
      } else {
        handleLoginFailure(data.message || 'Login failed')
      }
    } catch (error) {
      handleLoginFailure('Network error. Please try again.')
    }
  })

  // Handle forgot password (demo)
  forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault()
    showError('Demo: Use admin/admin123 to login')
  })

  function handleLoginSuccess(username) {
    // Redirect to main app immediately
    window.location.href = '/'
  }

  function handleLoginFailure(message) {
    showLoading(false)
    showError(message)
    // Removed shake animation for professional look
  }

  function showLoading(show) {
    const btnText = document.querySelector('.btn-text')
    
    if (show) {
      loginBtn.disabled = true
      // Fade out current text
      btnText.style.opacity = '0'
      btnText.style.transform = 'translateY(-5px)'
      
      setTimeout(() => {
        btnText.textContent = 'Loading...'
        // Fade in new text
        btnText.style.opacity = '1'
        btnText.style.transform = 'translateY(0)'
      }, 150)
    } else {
      loginBtn.disabled = false
      // Fade out current text
      btnText.style.opacity = '0'
      btnText.style.transform = 'translateY(-5px)'
      
      setTimeout(() => {
        btnText.textContent = 'Login'
        // Fade in new text
        btnText.style.opacity = '1'
        btnText.style.transform = 'translateY(0)'
      }, 150)
    }
  }

  function showError(message) {
    const errorEl = document.getElementById('loginError')
    errorEl.textContent = message
    errorEl.classList.remove('hidden')

    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorEl.classList.add('hidden')
    }, 5000)
  }

  // Handle remember me functionality
  const rememberMeCheckbox = document.getElementById('rememberMe')
  if (localStorage.getItem('rememberMe') === 'true') {
    rememberMeCheckbox.checked = true
    // Auto-fill username if remembered
    const lastUser = localStorage.getItem('lastUser')
    if (lastUser) {
      document.getElementById('username').value = lastUser
    }
  }

  // Store last user for convenience
  rememberMeCheckbox.addEventListener('change', () => {
    if (rememberMeCheckbox.checked) {
      localStorage.setItem('rememberMe', 'true')
      const username = document.getElementById('username').value.trim()
      if (username) {
        localStorage.setItem('lastUser', username)
      }
    } else {
      localStorage.removeItem('rememberMe')
      localStorage.removeItem('lastUser')
    }
  })

  // Auto-focus username field
  document.getElementById('username').focus()

  // Add enter key support for better UX
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !loginBtn.disabled) {
      loginForm.dispatchEvent(new Event('submit'))
    }
  })

  function showAlreadyLoggedIn(username) {
    const loginForm = document.getElementById('loginForm')

    // Hide the form and show already logged in message
    loginForm.style.display = 'none'

    const alreadyLoggedInDiv = document.createElement('div')
    alreadyLoggedInDiv.className = 'already-logged-in'
    alreadyLoggedInDiv.innerHTML = `
      <div class="success-message">
        <div class="success-icon">✅</div>
        <h3>Already Logged In</h3>
        <p>You are already logged in as <strong>${username}</strong></p>
        <div class="action-buttons">
          <button id="continueBtn" class="btn continue-btn">Continue to App</button>
          <button id="logoutBtn" class="btn logout-btn">Logout</button>
        </div>
      </div>
    `

    loginContainer.appendChild(alreadyLoggedInDiv)

    // Handle continue button
    document.getElementById('continueBtn').addEventListener('click', () => {
      window.location.href = '/'
    })

    // Handle logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try {
        await fetch('/api/logout', { method: 'POST' })
      } catch (error) {
        console.error('Logout failed:', error)
      }
      location.reload()
    })
  }
})