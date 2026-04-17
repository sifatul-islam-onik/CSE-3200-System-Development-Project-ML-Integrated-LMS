const fs = require('fs');

for (let file of ['client/src/styles/Login.css', 'client/src/styles/ForgotPassword.css']) {
    let css = fs.readFileSync(file, 'utf8');
    
    // Specifically fix form stuff
    css = css.replace('.OBESynK-login-form {\n  display: flex;\n  flex-direction: row;', '.OBESynK-login-form {\n  display: flex;\n  flex-direction: column;');
    css = css.replace('.OBESynK-form-group {\n  display: flex;\n  flex-direction: row;', '.OBESynK-form-group {\n  display: flex;\n  flex-direction: column;');
    
    css = css.replace('.OBESynK-reset-form {\n  display: flex;\n  flex-direction: row;', '.OBESynK-reset-form {\n  display: flex;\n  flex-direction: column;');
    css = css.replace('.OBESynK-reset-field {\n  display: flex;\n  flex-direction: row;', '.OBESynK-reset-field {\n  display: flex;\n  flex-direction: column;');
    
    css = css.replace('.OBESynK-auth-banner {\n  flex: 1;\n  display: flex;\n  flex-direction: row;', '.OBESynK-auth-banner {\n  flex: 1;\n  display: flex;\n  flex-direction: column;');
    
    css = css.replace('.OBESynK-login-page { flex-direction: row; }', '.OBESynK-login-page { flex-direction: column; }');
    css = css.replace('.OBESynK-reset-page { flex-direction: row; }', '.OBESynK-reset-page { flex-direction: column; }');

    fs.writeFileSync(file, css);
}
