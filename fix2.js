const fs = require('fs');
['client/src/styles/Login.css', 'client/src/styles/ForgotPassword.css'].forEach(file => {
    let css = fs.readFileSync(file, 'utf8');
    css = css.replace(/\.OBESynK-login-form\s*\{\s*display:\s*flex;\s*flex-direction:\s*row;/g, '.OBESynK-login-form {\n  display: flex;\n  flex-direction: column;');
    css = css.replace(/\.OBESynK-form-group\s*\{\s*display:\s*flex;\s*flex-direction:\s*row;/g, '.OBESynK-form-group {\n  display: flex;\n  flex-direction: column;');
    css = css.replace(/\.OBESynK-reset-form\s*\{\s*display:\s*flex;\s*flex-direction:\s*row;/g, '.OBESynK-reset-form {\n  display: flex;\n  flex-direction: column;');
    css = css.replace(/\.OBESynK-reset-field\s*\{\s*display:\s*flex;\s*flex-direction:\s*row;/g, '.OBESynK-reset-field {\n  display: flex;\n  flex-direction: column;');
    css = css.replace(/\.OBESynK-auth-banner\s*\{\s*flex:\s*1;\s*display:\s*flex;\s*flex-direction:\s*row;/g, '.OBESynK-auth-banner {\n  flex: 1;\n  display: flex;\n  flex-direction: column;');
    fs.writeFileSync(file, css);
});
