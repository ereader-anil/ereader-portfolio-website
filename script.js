// Toggle sidebar
        document.querySelector('.toggle-btn').addEventListener('click', function() {
            document.querySelector('.sidebar').classList.toggle('expanded');
        });
        // Navigation functionality remains the same
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                
                link.classList.add('active');
                document.querySelector(targetId).classList.add('active');
            });
        });
  