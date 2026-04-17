import sys
with open('client/src/styles/Login.css', 'r', encoding='utf-8') as f:
    login = f.read()

brand = '''
.OBESynK-auth-banner {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, rgba(4, 120, 87, 0.85), rgba(6, 95, 70, 0.95)), url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80') center/cover no-repeat;
  color: white;
  padding: 3rem;
  /* Make sure it's at least half the screen on desktop */
  min-height: 100vh;
}

.OBESynK-auth-banner-content {
  max-width: 500px;
  text-align: left;
}

.OBESynK-auth-banner-content h1 {
  font-size: 3.5rem;
  font-weight: 800;
  margin-bottom: 2rem;
  letter-spacing: -0.02em;
}

.OBESynK-auth-banner-content h2 {
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  line-height: 1.2;
}

.OBESynK-auth-banner-content p {
  font-size: 1.2rem;
  line-height: 1.6;
  opacity: 0.9;
}

.OBESynK-branding-mobile {
  display: none;
  margin-bottom: 2.5rem;
  text-align: center;
}

.OBESynK-branding-mobile h1 {
  margin: 0;
  font-family: "Inter", "Roboto", sans-serif;
  font-size: 2.5rem;
  font-weight: 700;
  color: #047857;
  letter-spacing: -0.02em;
}

.OBESynK-branding-mobile p {
  margin: 0.5rem 0 0;
  font-family: "Inter", "Roboto", sans-serif;
  font-size: 0.95rem;
  font-weight: 500;
  color: #475569;
}
'''

login = login.replace('flex-direction: column;', 'flex-direction: row;')
if '.OBESynK-auth-banner {' not in login:
    login = login.replace('@media (max-width: 768px) {', '@media (max-width: 768px) {\n  .OBESynK-login-page { flex-direction: column; }\n  .OBESynK-auth-banner { display: none; }\n  .OBESynK-branding-mobile { display: block; }\n')
    login += '\n\n' + brand

with open('client/src/styles/Login.css', 'w', encoding='utf-8') as f:
    f.write(login)

with open('client/src/styles/ForgotPassword.css', 'r', encoding='utf-8') as f:
    forgot = f.read()

forgot = forgot.replace('flex-direction: column;', 'flex-direction: row;')

if '.OBESynK-auth-banner {' not in forgot:
    forgot = forgot.replace('@media (max-width: 640px) {', '@media (max-width: 900px) {\n  .OBESynK-reset-page { flex-direction: column; }\n  .OBESynK-auth-banner { display: none; }\n  .OBESynK-branding-mobile { display: block; }\n}\n\n@media (max-width: 640px) {', 1)
    forgot += '\n\n' + brand

with open('client/src/styles/ForgotPassword.css', 'w', encoding='utf-8') as f:
    f.write(forgot)

print("Updated CSS files.")
