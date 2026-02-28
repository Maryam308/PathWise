package com.pathwise.backend.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenAPIConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("PathWise Financial API")
                        .description("""
                                # PathWise Financial Management API
                                
                                Welcome to the PathWise API documentation. This API powers the PathWise financial management platform,
                                providing comprehensive tools for personal financial planning, AI-powered coaching, and financial insights.
                                
                                ## Key Features
                                * **User Authentication** - Secure JWT-based authentication
                                * **Financial Accounts** - Connect and manage financial accounts via Plaid
                                * **AI Coaching** - Personalized financial advice using Groq AI
                                * **Goal Tracking** - Set and track financial goals
                                * **Analytics & Reports** - Generate financial insights and reports
                                * **Simulations** - Run financial scenarios and projections
                                * **Anomaly Detection** - Identify unusual financial patterns
                                
                                ## Authentication
                                Most endpoints require authentication using a JWT token. Include it in the Authorization header:
                                ```
                                Authorization: Bearer <your-jwt-token>
                                ```
                                
                                To get a token, use the `/auth/login` or `/auth/register` endpoints.
                                
                                ## Base URLs
                                * **Development**: http://localhost:8080
                                * **Production**: https://api.pathwise.com
                                
                                ## Rate Limits
                                * Free tier: 1000 requests/day
                                * Premium tier: 10000 requests/day
                                
                                For support, contact: api-support@pathwise.com
                                """)
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("PathWise API Support")
                                .email("api-support@pathwise.com")
                                .url("https://pathwise.com"))
                        .license(new License()
                                .name("Proprietary")
                                .url("https://pathwise.com/terms")))
                .servers(List.of(
                        new Server().url("http://localhost:8080").description("Development Server"),
                        new Server().url("https://api.pathwise.com").description("Production Server")
                ))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth",
                                new SecurityScheme()
                                        .name("bearerAuth")
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Enter your JWT token. Get it from POST /auth/login"))
                        .addSecuritySchemes("apiKey",
                                new SecurityScheme()
                                        .name("X-API-Key")
                                        .type(SecurityScheme.Type.APIKEY)
                                        .in(SecurityScheme.In.HEADER)
                                        .description("Alternative authentication using API Key (for webhooks)")))
                .tags(List.of(
                        new Tag().name("Authentication").description("User registration, login, and token management"),
                        new Tag().name("Plaid Integration").description("Connect and manage financial accounts via Plaid"),
                        new Tag().name("AI Coach").description("AI-powered financial advice and coaching"),
                        new Tag().name("Goals").description("Financial goal setting and tracking"),
                        new Tag().name("Analytics").description("Financial analytics and insights"),
                        new Tag().name("Reports").description("Generate and manage financial reports"),
                        new Tag().name("Simulations").description("Run financial what-if scenarios"),
                        new Tag().name("Projections").description("Financial projections and forecasts"),
                        new Tag().name("Anomalies").description("Detect and manage financial anomalies"),
                        new Tag().name("Profile").description("User profile management")
                ));
    }
}