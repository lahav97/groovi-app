import React, {createContext, useContext, useRef} from "react";
import UserBuilder from "../Builders/UserBuilder";

const SignupFlowContext = createContext(null);

export const SignupFlowProvider = ({ children }) => {
    const builderRef = useRef(new UserBuilder());
  
    return (
      <SignupFlowContext.Provider value={builderRef.current}>
        {children}
      </SignupFlowContext.Provider>
    );
  };
 
  export const useSignupBuilder = () => {
    const context = useContext(SignupFlowContext);
    if (!context) {
      throw new Error('useSignupBuilder must be used within a SignupFlowProvider');
    }
    return context;
  };